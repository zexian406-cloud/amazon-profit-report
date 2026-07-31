import * as XLSX from 'xlsx';
import {
  ReportType, ReportTypeFeature,
  SettlementReport, StorageFeeItem, AdReportItem, ReturnReportItem,
  UploadedReport, Transaction, SharedFee,
} from './types';

// ====== 报表类型自动检测特征配置 ======

export const REPORT_TYPE_FEATURES: ReportTypeFeature[] = [
  {
    type: 'settlement',
    keywords: ['settlement', '结算', 'settlement-id'],
    requiredColumns: [
      ['settlement-id', 'settlementid', 'settlement_id', '结算id', '结算编号'],
      ['total-amount', 'totalamount', '总额', 'settlement-total'],
    ],
    priority: 90,
  },
  {
    type: 'storage',
    keywords: ['storage', 'warehouse', '仓储', '仓储费', '月仓储', 'monthly-storage'],
    requiredColumns: [
      ['sku', 'SKU'],
      ['storage-fee', 'storagefee', '仓储费', '仓储费金额', 'fee-amount', 'monthly-storage-fee'],
    ],
    priority: 80,
  },
  {
    type: 'advertising',
    keywords: ['campaign', 'ad', '广告', 'sponsored', '推广', '广告报告'],
    requiredColumns: [
      ['campaign-name', 'campaignname', 'campaign_name', '广告活动', 'campaign'],
      ['spend', 'cost', '广告花费', '花费', 'cost-per-click', 'impressions', 'clicks'],
    ],
    priority: 70,
  },
  {
    type: 'return',
    keywords: ['return', '退货', '退款', 'return-report'],
    requiredColumns: [
      ['sku', 'SKU'],
      ['return-quantity', 'returnquantity', 'return_qty', '退货数量', 'quantity'],
      ['refund-amount', 'refundamount', '退款金额', 'refund'],
    ],
    priority: 60,
  },
  {
    type: 'transaction',
    keywords: ['transaction', '交易', 'date', 'amount', 'type', 'description', '明细'],
    requiredColumns: [
      ['date', '日期', 'transaction-date', 'settlement-date'],
      ['amount', '金额', 'total', 'total-amount'],
    ],
    priority: 50,
  },
];

// ====== 列名标准化（通用版） ======

function normalizeHeader(header: string): string {
  const map: Record<string, string> = {
    'date': 'date', '日期': 'date', 'transaction-date': 'date', 'transactiondate': 'date',
    'settlement-date': 'date', 'settlementdate': 'date', 'posted-date': 'date', 'posteddate': 'date',
    'sku': 'sku', 'SKU': 'sku',
    'asin': 'asin', 'ASIN': 'asin',
    'description': 'description', '描述': 'description', 'transaction-description': 'description',
    'type': 'type', '类型': 'type', 'transaction-type': 'type', 'transactiontype': 'type',
    'amount': 'amount', '金额': 'amount', 'total': 'amount', 'total-amount': 'amount',
    'quantity': 'quantity', '数量': 'quantity', 'qty': 'quantity',
    'order-id': 'orderId', 'orderid': 'orderId', '订单号': 'orderId',
    'currency': 'currency', '货币': 'currency',
    'store': 'store', '店铺': 'store', 'store-name': 'store',
    'category': 'category', '类别': 'category', '费用类别': 'category',
    'title': 'productName', '商品标题': 'productName',
    // 结算报告
    'settlement-id': 'settlementId', 'settlementid': 'settlementId', 'settlement_id': 'settlementId',
    'settlement-start-date': 'periodStart', 'settlementstartdate': 'periodStart',
    'settlement-end-date': 'periodEnd', 'settlementenddate': 'periodEnd',
    'deposit-date': 'depositDate', 'depositdate': 'depositDate',
    'settlement-total': 'totalAmount',
    'transaction-count': 'transactionCount', 'transactioncount': 'transactionCount',
    // 仓储报告
    'storage-fee': 'storageFee', 'storagefee': 'storageFee',
    'monthly-storage-fee': 'storageFee', 'monthly-storagefee': 'storageFee',
    'volume': 'volume', 'volume-cubic-feet': 'volume', 'cubic-feet': 'volume',
    'rate': 'rate', 'storage-rate': 'rate', '费率': 'rate',
    'fee-amount': 'storageFee', '仓储费': 'storageFee', '仓储费金额': 'storageFee',
    '仓储体积': 'volume', '体积': 'volume',
    // 广告报告
    'campaign-name': 'campaignName', 'campaignname': 'campaignName', 'campaign_name': 'campaignName',
    'campaign-type': 'campaignType', 'campaigntype': 'campaignType', 'campaign_type': 'campaignType',
    'ad-group': 'adGroup', 'adgroup': 'adGroup', '广告组': 'adGroup',
    'impressions': 'impressions', '曝光量': 'impressions', '曝光': 'impressions',
    'clicks': 'clicks', '点击量': 'clicks', '点击': 'clicks',
    'spend': 'spend', 'cost': 'spend', '广告花费': 'spend', '花费': 'spend',
    'sales': 'sales', '广告销售额': 'sales', '销售额': 'sales',
    'orders': 'orders', '广告订单': 'orders', '订单数': 'orders', '7-day-total-orders': 'orders',
    'acos': 'acos', 'acOS': 'acos', '广告销售成本': 'acos',
    'campaign': 'campaignName', '广告活动': 'campaignName',
    // 退货报告
    'return-quantity': 'returnQuantity', 'returnquantity': 'returnQuantity', 'return_qty': 'returnQuantity',
    'return-reason': 'returnReason', 'returnreason': 'returnReason', '退货原因': 'returnReason',
    'refund-amount': 'refundAmount', 'refundamount': 'refundAmount', '退款金额': 'refundAmount',
    'return-date': 'returnDate', 'returndate': 'returnDate', '退货日期': 'returnDate',
  };

  const key = header.toLowerCase().trim().replace(/[\s_-]+/g, '-');
  return map[key] || header;
}

// ====== 通用工具函数 ======

function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseQuantity(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return parseInt(cleaned) || 0;
}

function extractMonthFromDate(dateStr: string): string {
  const match = dateStr.match(/(\d{4})[-\/](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function readExcelFile(file: File): Promise<{ workbook: XLSX.WorkBook; jsonData: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

        if (rawData.length === 0) {
          reject(new Error('Excel文件为空'));
          return;
        }

        // 标准化列名
        const jsonData: Record<string, string>[] = rawData.map((row) => {
          const normalized: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            normalized[normalizeHeader(key)] = String(value);
          }
          return normalized;
        });

        resolve({ workbook, jsonData });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
}

// ====== 报表类型自动识别 ======

export function detectReportType(headers: string[]): ReportType {
  const headerStr = headers.join(' ').toLowerCase();

  let bestMatch: ReportType = 'transaction';
  let bestScore = 0;

  for (const feature of REPORT_TYPE_FEATURES) {
    let score = 0;

    // 关键词匹配
    for (const keyword of feature.keywords) {
      if (headerStr.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    // 必需列匹配
    for (const colGroup of feature.requiredColumns) {
      const matched = colGroup.some(col => headers.includes(col));
      if (matched) {
        score += 20;
      }
    }

    // 加权优先级
    score = Math.round(score * (feature.priority / 50));

    if (score > bestScore) {
      bestScore = score;
      bestMatch = feature.type;
    }
  }

  return bestMatch;
}

// ====== 结算报告解析 ======

export function parseSettlementReport(file: File): Promise<{
  settlement: SettlementReport;
  uploadedReports: UploadedReport[];
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const { jsonData } = await readExcelFile(file);

      const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

      // 提取结算周期
      const settlementId = String(jsonData[0]?.['settlementId'] || 'N/A');
      const periodStart = String(jsonData[0]?.['periodStart'] || '');
      const periodEnd = String(jsonData[0]?.['periodEnd'] || '');
      const month = periodStart ? extractMonthFromDate(periodStart) : extractMonthFromDate(new Date().toISOString());

      // 提取店铺
      const storeName = jsonData.find(r => r['store'])?.store || '一店';

      // 汇总金额
      let totalAmount = 0;
      let transactionCount = 0;
      const feeSummary: Record<string, number> = {};

      for (const row of jsonData) {
        const amount = parseAmount(row['totalAmount'] || row['amount'] || '0');
        totalAmount += amount;
        transactionCount++;

        // 按类型汇总费用
        const type = row['type'] || row['description'] || '其他';
        const typeKey = type.substring(0, 30);
        feeSummary[typeKey] = (feeSummary[typeKey] || 0) + amount;
      }

      const settlement: SettlementReport = {
        month,
        storeName,
        settlementId,
        periodStart,
        periodEnd,
        totalAmount: Math.round(totalAmount * 100) / 100,
        transactionCount,
        feeSummary,
        rawData: jsonData,
      };

      const uploadedReports: UploadedReport[] = [{
        id: `settlement-${Date.now()}`,
        fileName: file.name,
        reportType: 'settlement',
        month,
        storeName,
        uploadTime: new Date().toISOString(),
        rowCount: jsonData.length,
        status: 'parsed',
      }];

      resolve({ settlement, uploadedReports });
    } catch (error) {
      reject(error);
    }
  });
}

// ====== 仓储费报告解析 ======

export function parseStorageFeeReport(file: File): Promise<{
  storageFeeItems: StorageFeeItem[];
  uploadedReports: UploadedReport[];
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const { jsonData } = await readExcelFile(file);

      const storageFeeItems: StorageFeeItem[] = [];
      const monthSet = new Set<string>();
      let storeName = '一店';

      for (const row of jsonData) {
        const sku = row['sku'] || '';
        const asin = row['asin'] || '';
        const volume = parseAmount(row['volume']);
        const rate = parseAmount(row['rate']);
        const storageFee = parseAmount(row['storageFee']);
        const dateStr = row['date'] || '';
        const month = dateStr ? extractMonthFromDate(dateStr) : extractMonthFromDate(new Date().toISOString());
        monthSet.add(month);

        if (row['store']) storeName = row['store'];
        if (!sku) continue;

        storageFeeItems.push({
          sku,
          asin: asin || 'N/A',
          storageDate: dateStr || month,
          volumeCubicFeet: volume,
          rate,
          storageFee,
          month,
          storeName,
        });
      }

      const primaryMonth = Array.from(monthSet)[0] || extractMonthFromDate(new Date().toISOString());

      const uploadedReports: UploadedReport[] = [{
        id: `storage-${Date.now()}`,
        fileName: file.name,
        reportType: 'storage',
        month: primaryMonth,
        storeName,
        uploadTime: new Date().toISOString(),
        rowCount: jsonData.length,
        status: 'parsed',
      }];

      resolve({ storageFeeItems, uploadedReports });
    } catch (error) {
      reject(error);
    }
  });
}

// ====== 广告报告解析 ======

export function parseAdReport(file: File): Promise<{
  adReportItems: AdReportItem[];
  uploadedReports: UploadedReport[];
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const { jsonData } = await readExcelFile(file);

      const adReportItems: AdReportItem[] = [];
      let storeName = '一店';
      const monthSet = new Set<string>();

      for (const row of jsonData) {
        const campaignName = row['campaignName'] || '';
        let campaignType = row['campaignType'] || 'SP';
        // 从文件名或内容推断广告类型
        if (campaignType === 'SP' || campaignType === 'Sponsored Products') campaignType = 'SP';
        else if (campaignType === 'SB' || campaignType === 'Sponsored Brands') campaignType = 'SB';
        else if (campaignType === 'SD' || campaignType === 'Sponsored Display') campaignType = 'SD';

        const sku = row['sku'] || '';
        const asin = row['asin'] || '';
        const impressions = parseQuantity(row['impressions']);
        const clicks = parseQuantity(row['clicks']);
        const spend = parseAmount(row['spend'] || row['cost'] || '0');
        const sales = parseAmount(row['sales'] || '0');
        const orders = parseQuantity(row['orders']);
        const acos = spend > 0 ? Math.round((spend / (sales || 1)) * 10000) / 10000 : 0;

        if (row['store']) storeName = row['store'];

        const dateStr = row['date'] || '';
        const month = dateStr ? extractMonthFromDate(dateStr) : extractMonthFromDate(new Date().toISOString());
        monthSet.add(month);

        adReportItems.push({
          campaignName,
          campaignType,
          sku: sku || 'N/A',
          asin: asin || 'N/A',
          impressions,
          clicks,
          spend,
          sales,
          orders,
          acos,
          month,
          storeName,
        });
      }

      const primaryMonth = Array.from(monthSet)[0] || extractMonthFromDate(new Date().toISOString());

      const uploadedReports: UploadedReport[] = [{
        id: `ad-${Date.now()}`,
        fileName: file.name,
        reportType: 'advertising',
        month: primaryMonth,
        storeName,
        uploadTime: new Date().toISOString(),
        rowCount: jsonData.length,
        status: 'parsed',
      }];

      resolve({ adReportItems, uploadedReports });
    } catch (error) {
      reject(error);
    }
  });
}

// ====== 退货报告解析 ======

export function parseReturnReport(file: File): Promise<{
  returnReportItems: ReturnReportItem[];
  uploadedReports: UploadedReport[];
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const { jsonData } = await readExcelFile(file);

      const returnReportItems: ReturnReportItem[] = [];
      let storeName = '一店';
      const monthSet = new Set<string>();

      for (const row of jsonData) {
        const sku = row['sku'] || '';
        const asin = row['asin'] || '';
        const productName = row['productName'] || '';
        const returnQuantity = parseQuantity(row['returnQuantity'] || row['quantity'] || '0');
        const refundAmount = parseAmount(row['refundAmount'] || '0');
        const returnReason = row['returnReason'] || '';
        const returnDate = row['returnDate'] || row['date'] || '';

        if (row['store']) storeName = row['store'];
        if (!sku) continue;

        const month = returnDate ? extractMonthFromDate(returnDate) : extractMonthFromDate(new Date().toISOString());
        monthSet.add(month);

        returnReportItems.push({
          sku,
          asin: asin || 'N/A',
          productName,
          returnQuantity,
          refundAmount,
          returnReason,
          returnDate,
          month,
          storeName,
        });
      }

      const primaryMonth = Array.from(monthSet)[0] || extractMonthFromDate(new Date().toISOString());

      const uploadedReports: UploadedReport[] = [{
        id: `return-${Date.now()}`,
        fileName: file.name,
        reportType: 'return',
        month: primaryMonth,
        storeName,
        uploadTime: new Date().toISOString(),
        rowCount: jsonData.length,
        status: 'parsed',
      }];

      resolve({ returnReportItems, uploadedReports });
    } catch (error) {
      reject(error);
    }
  });
}

// ====== 通用多报表解析入口 ======

export async function parseReportByType(
  file: File,
  reportType: ReportType
): Promise<{
  reportType: ReportType;
  settlement?: SettlementReport;
  storageFeeItems?: StorageFeeItem[];
  adReportItems?: AdReportItem[];
  returnReportItems?: ReturnReportItem[];
  uploadedReports: UploadedReport[];
}> {
  switch (reportType) {
    case 'settlement': {
      const result = await parseSettlementReport(file);
      return { reportType, settlement: result.settlement, uploadedReports: result.uploadedReports };
    }
    case 'storage': {
      const result = await parseStorageFeeReport(file);
      return { reportType, storageFeeItems: result.storageFeeItems, uploadedReports: result.uploadedReports };
    }
    case 'advertising': {
      const result = await parseAdReport(file);
      return { reportType, adReportItems: result.adReportItems, uploadedReports: result.uploadedReports };
    }
    case 'return': {
      const result = await parseReturnReport(file);
      return { reportType, returnReportItems: result.returnReportItems, uploadedReports: result.uploadedReports };
    }
    default:
      throw new Error(`不支持的报表类型: ${reportType}`);
  }
}

// ====== 从报表数据生成共享费用 ======

export function extractSharedFeesFromReports(
  settlement?: SettlementReport,
  adReportItems?: AdReportItem[],
  storageFeeItems?: StorageFeeItem[],
  month?: string,
  storeName?: string
): SharedFee[] {
  const fees: SharedFee[] = [];
  const m = month || extractMonthFromDate(new Date().toISOString());
  const s = storeName || '一店';

  // 从结算报告提取费用汇总（不含交易明细中已包含的）
  if (settlement) {
    for (const [type, amount] of Object.entries(settlement.feeSummary)) {
      if (amount < 0 && Math.abs(amount) > 0.01) {
        fees.push({
          month: m,
          storeName: s,
          category: mapFeeType(type),
          totalAmount: amount,
          description: `结算报告-${type}`,
          source: 'settlement',
        });
      }
    }
  }

  // 从广告报告汇总总广告费
  if (adReportItems && adReportItems.length > 0) {
    const totalAdSpend = adReportItems.reduce((sum, item) => sum + item.spend, 0);
    // 检查是否有按SKU归属的广告费，有则按SKU汇总，否则作为共享费用
    const skuAdSpend = new Map<string, number>();
    let noSkuSpend = 0;

    for (const item of adReportItems) {
      if (item.sku && item.sku !== 'N/A') {
        skuAdSpend.set(item.sku, (skuAdSpend.get(item.sku) || 0) + item.spend);
      } else {
        noSkuSpend += item.spend;
      }
    }

    if (noSkuSpend > 0.01) {
      fees.push({
        month: m,
        storeName: s,
        category: 'AdFee',
        totalAmount: -noSkuSpend,
        description: `广告报告-无SKU广告费`,
        source: 'ad_report',
      });
    }
  }

  return fees;
}

function mapFeeType(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('ad') || lower.includes('广告')) return 'AdFee';
  if (lower.includes('storage') || lower.includes('仓储')) return 'StorageFee';
  if (lower.includes('subscription') || lower.includes('订阅')) return 'SubscriptionFee';
  if (lower.includes('inbound') || lower.includes('入库')) return 'InboundFee';
  if (lower.includes('return') || lower.includes('退货')) return 'ReturnFee';
  if (lower.includes('vine')) return 'Other';
  return 'Other';
}

// 导出工具 - 获取报表类型对应的颜色
export function getReportTypeColor(type: ReportType): string {
  const colors: Record<ReportType, string> = {
    transaction: '#3b82f6',
    settlement: '#8b5cf6',
    storage: '#f59e0b',
    advertising: '#ef4444',
    return: '#10b981',
  };
  return colors[type] || '#6b7280';
}

// 获取报表类型对应的图标
export function getReportTypeIcon(type: ReportType): string {
  const icons: Record<ReportType, string> = {
    transaction: 'FileSpreadsheet',
    settlement: 'FileCheck',
    storage: 'Warehouse',
    advertising: 'BarChart3',
    return: 'Undo2',
  };
  return icons[type] || 'File';
}