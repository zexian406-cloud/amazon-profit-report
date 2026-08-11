import * as XLSX from 'xlsx';
import {
  Transaction, TransactionType, SharedFee, ParseResult, Reconciliation,
  StorageFeeItem, PromotionFeeItem, UploadedReport, ReportType,
} from './types';
import { detectTransactionType, normalizeHeader, parseAmount, parseQuantity } from './sheet-utils';

// ====== 多表格Sheet检测结果 ======
export interface SheetDetectionResult {
  sheetName: string;
  detectedType: ReportType;
  headers: string[];
  rowCount: number;
  confidence: number;   // 置信度 0-1
  preview: Record<string, string>[]; // 前5行预览
}

// ====== 多表格解析结果 ======
export interface MultiSheetParseResult {
  sheets: SheetDetectionResult[];
  // 解析后的数据（按类型分组）
  transactions: Transaction[];
  sharedFees: SharedFee[];
  storageFeeItems: StorageFeeItem[];
  promotionFeeItems: PromotionFeeItem[];
  month: string;
  storeName: string;
  uploadedReports: UploadedReport[];
}

// ====== Sheet类型检测 ======

export function detectSheetType(
  sheetName: string,
  headers: string[],
  data: Record<string, any>[]
): { type: ReportType; confidence: number } {
  const nameLower = sheetName.toLowerCase();
  const headerStr = headers.join(' ').toLowerCase();
  const nameAndHeaders = (sheetName + ' ' + headerStr).toLowerCase();

  // 1. 促销费用分摊 - 关键词匹配
  if (
    nameAndHeaders.includes('促销') ||
    headers.some(h => h.includes('促销编码') || h.includes('促销总费用') || h.includes('promotion'))
  ) {
    return { type: 'promotionFee', confidence: 0.9 };
  }

  // 2. 仓储费 - 关键词匹配
  if (
    nameAndHeaders.includes('仓储') ||
    headers.some(h => h.includes('仓储费') || h.includes('月度仓储费') || h.includes('storage'))
  ) {
    return { type: 'storage', confidence: 0.85 };
  }

  // 3. 广告报告
  if (
    nameAndHeaders.includes('广告') || nameAndHeaders.includes('campaign') ||
    headers.some(h => h.includes('campaign') || h.includes('spend') || h.includes('impressions'))
  ) {
    return { type: 'advertising', confidence: 0.8 };
  }

  // 4. 退货报告
  if (
    nameAndHeaders.includes('退货') || nameAndHeaders.includes('return') ||
    headers.some(h => h.includes('return-reason') || h.includes('退货原因'))
  ) {
    return { type: 'return', confidence: 0.75 };
  }

  // 5. 产品成本/FOB
  if (
    nameAndHeaders.includes('fob') || nameAndHeaders.includes('成本') || nameAndHeaders.includes('采购') ||
    headers.some(h => h.includes('fob') || h.includes('成本') || h.includes('采购价'))
  ) {
    return { type: 'productCost', confidence: 0.75 };
  }

  // 6. 尾程运费
  if (
    nameAndHeaders.includes('尾程') || nameAndHeaders.includes('运费') ||
    headers.some(h => h.includes('delivery-fee') || h.includes('shipping-fee'))
  ) {
    return { type: 'deliveryFee', confidence: 0.7 };
  }

  // 7. 结算报告
  if (
    nameAndHeaders.includes('settlement') || nameAndHeaders.includes('结算') ||
    headers.some(h => h.includes('settlement-id') || h.includes('settlement-id'))
  ) {
    return { type: 'settlement', confidence: 0.85 };
  }

  // 8. 交易明细 - Amazon月度交易格式
  // 特征: 有 date/time, type, sku, total 等列
  const hasDateTime = headers.some(h => h.toLowerCase().includes('date') && h.toLowerCase().includes('time'));
  const hasType = headers.some(h => h.toLowerCase() === 'type');
  const hasSku = headers.some(h => h.toLowerCase() === 'sku');
  const hasTotal = headers.some(h => h.toLowerCase() === 'total' || h.toLowerCase().includes('total'));
  const hasSettlementId = headers.some(h => h.toLowerCase().includes('settlement id') || h.toLowerCase().includes('settlement-id'));
  const hasProductSales = headers.some(h => h.toLowerCase().includes('product sales'));
  const hasSellingFees = headers.some(h => h.toLowerCase().includes('selling fees'));
  const hasFbaFees = headers.some(h => h.toLowerCase().includes('fba fees'));

  const amazonFormatScore = [hasDateTime, hasType, hasSku, hasTotal, hasSettlementId, hasProductSales, hasSellingFees, hasFbaFees].filter(Boolean).length;

  // 标准交易明细格式: date + amount/type
  const hasDate = headers.some(h => {
    const norm = normalizeHeader(h);
    return norm === 'date';
  });
  const hasAmount = headers.some(h => {
    const norm = normalizeHeader(h);
    return norm === 'amount';
  });

  if (amazonFormatScore >= 4) {
    return { type: 'transaction', confidence: 0.95 };
  }

  if (hasDate && hasAmount && (hasType || hasSku)) {
    return { type: 'transaction', confidence: 0.8 };
  }

  // 9. 负责人映射
  if (
    headers.some(h => h.includes('负责人') || h.toLowerCase().includes('manager')) &&
    headers.some(h => h.toLowerCase() === 'sku')
  ) {
    return { type: 'managerMapping', confidence: 0.7 };
  }

  // 默认: 交易明细
  return { type: 'transaction', confidence: 0.3 };
}

// ====== 读取Excel所有Sheet ======

export function readWorkbookSheets(file: File): Promise<{
  workbook: XLSX.WorkBook;
  sheets: { name: string; rawData: Record<string, any>[]; headers: string[]; headerRowIndex: number }[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          // 先尝试直接读取（第一行是表头）
          let rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

          // 检查第一行是否是标题行（合并单元格或只有一列有值）
          // 这种情况常见于"促销费用分摊"类型的sheet
          let headerRowIndex = 0;

          if (rawData.length === 0 || (rawData.length > 0 && Object.keys(rawData[0]).length <= 1)) {
            // 尝试从第二行读取表头
            const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
            // 找到第一个有2个以上非空值的行作为表头
            for (let i = 0; i < Math.min(allRows.length, 5); i++) {
              const nonEmptyCount = (allRows[i] || []).filter((v: any) => v !== '' && v != null).length;
              if (nonEmptyCount >= 2) {
                headerRowIndex = i;
                break;
              }
            }

            if (headerRowIndex > 0 && allRows.length > headerRowIndex) {
              const headerRow = allRows[headerRowIndex];
              const dataRows = allRows.slice(headerRowIndex + 1);
              rawData = dataRows.map(row => {
                const obj: Record<string, any> = {};
                headerRow.forEach((header: any, idx: number) => {
                  if (header != null && header !== '') {
                    obj[String(header)] = row[idx] ?? '';
                  }
                });
                return obj;
              });
            }
          }

          const headers = rawData.length > 0 ? Object.keys(rawData[0]) : [];

          return { name, rawData, headers, headerRowIndex };
        });

        resolve({ workbook, sheets });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
}

// ====== 预检测所有Sheet类型 ======

export async function detectAllSheets(file: File): Promise<SheetDetectionResult[]> {
  const { sheets } = await readWorkbookSheets(file);

  const results: SheetDetectionResult[] = sheets.map(sheet => {
    // 标准化headers
    const normalizedHeaders = sheet.headers.map(h => normalizeHeader(h));
    const { type, confidence } = detectSheetType(sheet.name, normalizedHeaders, sheet.rawData);

    // 生成预览（标准化列名后的前5行）
    const preview = sheet.rawData.slice(0, 5).map(row => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = String(value);
      }
      return normalized;
    });

    return {
      sheetName: sheet.name,
      detectedType: type,
      headers: sheet.headers,
      rowCount: sheet.rawData.length,
      confidence,
      preview,
    };
  });

  return results;
}

// ====== 解析单个Sheet为交易明细 ======

function parseTransactionSheet(
  rawData: Record<string, any>[],
  sheetName: string,
  storeName: string,
  month: string
): { transactions: Transaction[]; sharedFees: SharedFee[]; totalBillAmount: number } {
  const transactions: Transaction[] = [];
  const sharedFees: SharedFee[] = [];
  let totalBillAmount = 0;

  for (const row of rawData) {
    // 标准化行
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value);
    }

    const amount = parseAmount(normalized['amount'] || normalized['total'] || '0');
    totalBillAmount += amount;

    const type = detectTransactionType(normalized);
    const sku = normalized['sku'] || '';
    const asin = normalized['asin'] || 'N/A';
    const description = normalized['description'] || normalized['productName'] || '';
    const quantity = parseQuantity(normalized['quantity']);
    const orderId = normalized['orderId'] || '';
    const currency = normalized['currency'] || 'USD';
    const category = normalized['category'] || '';

    // 共享费用（无SKU的费用）
    if (!sku || sku === 'N/A' || sku === '') {
      if (amount !== 0) {
        sharedFees.push({
          month,
          storeName,
          category: type,
          totalAmount: amount,
          description: description || `${type}费用`,
        });
      }
      continue;
    }

    transactions.push({
      date: normalized['date'] || month,
      type,
      sku,
      asin,
      description,
      quantity,
      unitPrice: quantity !== 0 ? amount / quantity : amount,
      totalAmount: amount,
      currency,
      orderId,
      storeName,
      category,
      manager: normalized['manager'] || '',
      rawRow: normalized,
    });
  }

  return { transactions, sharedFees, totalBillAmount };
}

// ====== 解析仓储费Sheet ======

function parseStorageSheet(
  rawData: Record<string, any>[],
  sheetName: string,
  storeName: string,
  month: string
): StorageFeeItem[] {
  const items: StorageFeeItem[] = [];

  for (const row of rawData) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value);
    }

    const sku = normalized['sku'] || '';
    if (!sku) continue;

    // 支持"月度仓储费"列名
    const storageFee = parseAmount(
      normalized['storageFee'] ||
      normalized['月度仓储费'] ||
      normalized['仓储费'] ||
      normalized['fee-amount'] ||
      '0'
    );

    items.push({
      sku,
      asin: normalized['asin'] || 'N/A',
      storageDate: normalized['date'] || month,
      volumeCubicFeet: parseAmount(normalized['volume'] || '0'),
      rate: parseAmount(normalized['rate'] || '0'),
      storageFee,
      month,
      storeName,
    });
  }

  return items;
}

// ====== 解析促销费用分摊Sheet ======

function parsePromotionSheet(
  rawData: Record<string, any>[],
  sheetName: string,
  storeName: string,
  month: string
): PromotionFeeItem[] {
  const items: PromotionFeeItem[] = [];

  for (const row of rawData) {
    // 促销费用分摊sheet的列名可能是: 促销编码, sku, 销售额, 促销总费用
    const promoCode = String(row['促销编码'] || row['promotion-code'] || row['promotionCode'] || '');
    const sku = String(row['sku'] || row['SKU'] || '');
    const salesAmount = parseAmount(String(row['销售额'] || row['sales'] || '0'));
    const totalFee = parseAmount(String(row['促销总费用'] || row['total-fee'] || row['totalFee'] || '0'));

    if (!sku && !promoCode) continue;

    items.push({
      sku: sku || 'N/A',
      promotionCode: promoCode,
      salesAmount,
      totalFee,
      month,
      storeName,
    });
  }

  return items;
}

// ====== 从日期字符串提取月份 ======

function extractMonthFromSheet(sheetName: string, data: Record<string, any>[]): string {
  // 尝试从sheet名提取月份 (如 2026JulMonthlyTransaction → 2026-07)
  const nameMatch = sheetName.match(/(\d{4})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (nameMatch) {
    const year = nameMatch[1];
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const monthNum = monthMap[nameMatch[2].toLowerCase()];
    if (monthNum) return `${year}-${monthNum}`;
  }

  // 尝试从数据中提取
  for (const row of data.slice(0, 10)) {
    for (const value of Object.values(row)) {
      const str = String(value || '');
      // 匹配 "Jul 1, 2026" 格式
      const dateMatch = str.match(/(\d{4})[-\/](\d{1,2})/);
      if (dateMatch) {
        return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}`;
      }
      // 匹配 "Jul ... 2026" 格式
      const monthMatch = str.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*(\d{4})/i);
      if (monthMatch) {
        const year = monthMatch[2];
        const monthMap: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        };
        const monthNum = monthMap[monthMatch[1].toLowerCase().substring(0, 3)];
        if (monthNum) return `${year}-${monthNum}`;
      }
    }
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ====== 多表格一键解析 ======

export async function parseMultiSheetFile(
  file: File,
  storeName: string,
  sheetTypeOverrides?: Record<string, ReportType>
): Promise<MultiSheetParseResult> {
  const { sheets } = await readWorkbookSheets(file);

  const store = storeName || '一店';
  let primaryMonth = '';
  const allTransactions: Transaction[] = [];
  const allSharedFees: SharedFee[] = [];
  const allStorageFeeItems: StorageFeeItem[] = [];
  const allPromotionFeeItems: PromotionFeeItem[] = [];
  const uploadedReports: UploadedReport[] = [];
  let totalBillAmount = 0;

  // 先从交易明细sheet提取月份
  for (const sheet of sheets) {
    const normalizedHeaders = sheet.headers.map(h => normalizeHeader(h));
    const { type } = detectSheetType(sheet.name, normalizedHeaders, sheet.rawData);
    if (type === 'transaction') {
      primaryMonth = extractMonthFromSheet(sheet.name, sheet.rawData);
      break;
    }
  }

  // 如果没有交易明细sheet，使用第一个sheet提取月份
  if (!primaryMonth && sheets.length > 0) {
    primaryMonth = extractMonthFromSheet(sheets[0].name, sheets[0].rawData);
  }

  if (!primaryMonth) {
    const now = new Date();
    primaryMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // 解析每个sheet
  for (const sheet of sheets) {
    const normalizedHeaders = sheet.headers.map(h => normalizeHeader(h));
    let { type: detectedType } = detectSheetType(sheet.name, normalizedHeaders, sheet.rawData);

    // 应用用户覆盖的类型
    if (sheetTypeOverrides && sheetTypeOverrides[sheet.name]) {
      detectedType = sheetTypeOverrides[sheet.name];
    }

    if (sheet.rawData.length === 0) continue;

    const reportId = `${detectedType}-${sheet.name}-${Date.now()}`;

    switch (detectedType) {
      case 'transaction': {
        const result = parseTransactionSheet(sheet.rawData, sheet.name, store, primaryMonth);
        allTransactions.push(...result.transactions);
        allSharedFees.push(...result.sharedFees);
        totalBillAmount += result.totalBillAmount;

        uploadedReports.push({
          id: reportId,
          fileName: file.name,
          reportType: 'transaction',
          month: primaryMonth,
          storeName: store,
          uploadTime: new Date().toISOString(),
          rowCount: result.transactions.length,
          status: 'parsed',
          sheetName: sheet.name,
        });
        break;
      }

      case 'storage': {
        const items = parseStorageSheet(sheet.rawData, sheet.name, store, primaryMonth);
        allStorageFeeItems.push(...items);

        uploadedReports.push({
          id: reportId,
          fileName: file.name,
          reportType: 'storage',
          month: primaryMonth,
          storeName: store,
          uploadTime: new Date().toISOString(),
          rowCount: items.length,
          status: 'parsed',
          sheetName: sheet.name,
        });
        break;
      }

      case 'promotionFee': {
        const items = parsePromotionSheet(sheet.rawData, sheet.name, store, primaryMonth);
        allPromotionFeeItems.push(...items);

        uploadedReports.push({
          id: reportId,
          fileName: file.name,
          reportType: 'promotionFee',
          month: primaryMonth,
          storeName: store,
          uploadTime: new Date().toISOString(),
          rowCount: items.length,
          status: 'parsed',
          sheetName: sheet.name,
        });
        break;
      }

      default:
        // 未识别的sheet跳过
        break;
    }
  }

  // 处理订阅费 - 作为共享费用
  const hasSubscription = allSharedFees.some(f => f.category === 'SubscriptionFee');
  if (!hasSubscription) {
    allSharedFees.push({
      month: primaryMonth,
      storeName: store,
      category: 'SubscriptionFee',
      totalAmount: -39.99,
      description: '月订阅费（专业销售计划）',
    });
  }

  return {
    sheets: [], // 已处理，不需要返回预检测结果
    transactions: allTransactions,
    sharedFees: allSharedFees,
    storageFeeItems: allStorageFeeItems,
    promotionFeeItems: allPromotionFeeItems,
    month: primaryMonth,
    storeName: store,
    uploadedReports,
  };
}
