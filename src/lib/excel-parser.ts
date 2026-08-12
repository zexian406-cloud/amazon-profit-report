import * as XLSX from 'xlsx';
import { Transaction, TransactionType, ParseResult, SharedFee, FEE_CATEGORY_MAP } from './types';
import { readFileSmart } from './file-reader';

// 判断交易类型
function detectTransactionType(row: Record<string, string>): TransactionType {
  const desc = (row['描述'] || row['Description'] || row['description'] || '').toLowerCase();
  const type = (row['类型'] || row['Type'] || row['type'] || '').toLowerCase();

  // 按Amazon类型判断（优先使用type列，不依赖金额正负）
  if (type.includes('refund') || type.includes('退款') || type.includes('退货')) {
    return 'Refund';
  }
  if (type.includes('adjustment') || type.includes('调整')) {
    return 'Adjustment';
  }
  if (type.includes('service fee') || type.includes('servicefee')) {
    // Amazon 服务费
    if (desc.includes('subscription') || desc.includes('订阅') || desc.includes('专业销售')) {
      return 'SubscriptionFee';
    }
    if (desc.includes('storage') || desc.includes('仓储')) {
      return 'StorageFee';
    }
    return 'Other';
  }
  if (type.includes('transfer')) {
    return 'Other';
  }
  // Order类型：Amazon订单中包含正负金额项目（Product Sales正、Commission负等）
  // 不能用金额正负判断是否退款，应保持为Order，由利润计算器按描述分类
  if (type.includes('order') || type.includes('订单')) {
    // 检查是否是FBA费用（在Order类型中的FBA相关费用）
    if (desc.includes('fba') || desc.includes('fulfillment') || desc.includes('pick') || desc.includes('pack')) {
      if (desc.includes('return') || desc.includes('退货处理')) return 'ReturnFee';
      if (desc.includes('inbound') || desc.includes('入库')) return 'InboundFee';
      return 'FBAFee';
    }
    // 检查是否是仓储费
    if (desc.includes('storage') || desc.includes('仓储')) {
      return 'StorageFee';
    }
    // 佣金、产品销售、运费等都保持为Order类型
    return 'Order';
  }

  // 1. 仓储费
  if (desc.includes('storage') || desc.includes('仓储')) {
    if (desc.includes('aged') || desc.includes('超龄') || desc.includes('长期')) return 'StorageFee';
    return 'StorageFee';
  }

  // 2. FBA相关
  if (desc.includes('fba') || desc.includes('fulfillment') || desc.includes('配送')) {
    if (desc.includes('return') || desc.includes('退货处理')) return 'ReturnFee';
    if (desc.includes('inbound') || desc.includes('入库') || desc.includes('配置费')) return 'InboundFee';
    if (desc.includes('removal') || desc.includes('移除') || desc.includes('弃置')) return 'DisposalFee';
    if (desc.includes('shipping') || desc.includes('配送费')) return 'FBAFee';
    if (desc.includes('storage') || desc.includes('仓储')) return 'StorageFee';
    return 'FBAFee';
  }

  // 3. 订阅费
  if (desc.includes('subscription') || desc.includes('订阅') || desc.includes('专业销售')) {
    return 'SubscriptionFee';
  }

  // 4. 广告费
  if (desc.includes('ad') || desc.includes('广告') || desc.includes('推广') || desc.includes('campaign')) {
    return 'AdFee';
  }

  // 5. Coupon费
  if (desc.includes('coupon') || desc.includes('优惠券')) {
    return 'CouponFee';
  }

  // 6. 清算/清货
  if (desc.includes('liquidation') || desc.includes('清算') || desc.includes('清货')) {
    return 'LiquidationFee';
  }

  // 7. 库存赔偿
  if (desc.includes('inventory') || desc.includes('赔偿') || desc.includes('compensation')) {
    return 'InventoryCompensation';
  }

  // 8. SAFE-T赔付
  if (desc.includes('safe-t') || desc.includes('safet') || desc.includes('赔付') || desc.includes('claims')) {
    return 'SafeTClaim';
  }

  // 9. 弃置费
  if (desc.includes('disposal') || desc.includes('弃置') || desc.includes('removal')) {
    return 'DisposalFee';
  }

  // 10. 移除订单费
  if (desc.includes('removal') || desc.includes('移除') || desc.includes('订单移除')) {
    return 'RemovalFee';
  }

  // 11. Vine注册
  if (desc.includes('vine') || desc.includes('注册')) {
    return 'Other';
  }

  // 12. 佣金/referral - 作为订单处理
  if (desc.includes('commission') || desc.includes('佣金') || desc.includes('referral')) {
    return 'Order';
  }

  return 'Other';
}

// 解析金额
function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned) || 0;
}

// 解析数量
function parseQuantity(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return parseInt(cleaned) || 0;
}

// 标准化列名
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
    '商品名称': 'productName', 'product-name': 'productName', 'productname': 'productName',
    'title': 'productName', '商品标题': 'productName',
    '负责人': 'manager', 'manager': 'manager', '责任人': 'manager', '经办人': 'manager',
  };

  const key = header.toLowerCase().trim().replace(/[\s_-]+/g, '-');
  return map[key] || header;
}

export async function parseExcel(file: File): Promise<ParseResult> {
  try {
    const workbook = await readFileSmart(file);

    // 取第一个sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

    if (jsonData.length === 0) {
      throw new Error('Excel文件为空');
    }

    // 标准化列名
    const normalizedData: Record<string, string>[] = jsonData.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = String(value);
      }
      return normalized;
    });

    // 提取月份和店铺
    const month = extractMonth(normalizedData);
    const storeName = extractStoreName(normalizedData);

    // 解析交易记录
    const transactions: Transaction[] = [];
    const sharedFees: SharedFee[] = [];
    let totalBillAmount = 0;

    for (const row of normalizedData) {
      const amount = parseAmount(row['amount']);
      totalBillAmount += amount;

      const type = detectTransactionType(row);
      const sku = row['sku'] || 'N/A';
      const asin = row['asin'] || 'N/A';
      const description = row['description'] || row['productName'] || '';
      const quantity = parseQuantity(row['quantity']);
      const orderId = row['orderId'] || '';
      const currency = row['currency'] || 'USD';
      const category = row['category'] || '';

      // 共享费用（无SKU的费用）
      if (sku === 'N/A' || sku === '' || !row['sku']) {
        const feeCategory = mapToFeeCategory(type, description, category);
        if (amount !== 0) {
          sharedFees.push({
            month,
            storeName,
            category: feeCategory,
            totalAmount: amount,
            description: description || `${type}费用`,
          });
        }
        continue;
      }

      transactions.push({
        date: row['date'] || month,
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
        manager: row['manager'] || '',
        rawRow: row,
      });
    }

    // 处理订阅费 - 作为共享费用
    const subscriptionFee = sharedFees.find(f => f.category === 'SubscriptionFee');
    if (!subscriptionFee) {
      // 默认添加订阅费
      sharedFees.push({
        month,
        storeName,
        category: 'SubscriptionFee',
        totalAmount: -39.99,
        description: '月订阅费（专业销售计划）',
      });
    }

    // 计算净收入
    const orderTotal = transactions
      .filter(t => t.type === 'Order')
      .reduce((s, t) => s + t.totalAmount, 0);
    const refundTotal = transactions
      .filter(t => t.type === 'Refund')
      .reduce((s, t) => s + t.totalAmount, 0);
    const skuNetIncome = orderTotal + refundTotal; // refund是负数
    const sharedFeeTotal = sharedFees.reduce((s, f) => s + f.totalAmount, 0);

    const reconciliation = {
      month,
      storeName,
      skuNetIncome: Math.round(skuNetIncome * 100) / 100,
      sharedFeeTotal: Math.round(sharedFeeTotal * 100) / 100,
      totalNetIncome: Math.round((skuNetIncome + sharedFeeTotal) * 100) / 100,
      grandTotalFromBill: Math.round(totalBillAmount * 100) / 100,
      difference: Math.round((totalBillAmount - (skuNetIncome + sharedFeeTotal)) * 100) / 100,
    };

    return {
      month,
      storeName,
      transactions,
      sharedFees,
      reconciliation,
    };
  } catch (error) {
    throw error;
  }
}

function extractMonth(data: Record<string, string>[]): string {
  // 尝试从日期列提取月份
  const dateStrs = data
    .map(r => r['date'] || '')
    .filter(d => d.length > 0)
    .slice(0, 10);

  for (const dateStr of dateStrs) {
    const match = dateStr.match(/(\d{4})[-\/](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}`;
    }
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function extractStoreName(data: Record<string, string>[]): string {
  const stores = data
    .map(r => r['store'] || '')
    .filter(s => s.length > 0);

  if (stores.length > 0) {
    return stores[0];
  }
  return '一店';
}

function mapToFeeCategory(type: TransactionType, description: string, category: string): string {
  if (category && FEE_CATEGORY_MAP[category]) {
    return FEE_CATEGORY_MAP[category];
  }

  const descLower = description.toLowerCase();
  for (const [key, value] of Object.entries(FEE_CATEGORY_MAP)) {
    if (descLower.includes(key.toLowerCase())) {
      return value;
    }
  }

  const typeMap: Record<string, string> = {
    'AdFee': 'AdFee',
    'StorageFee': 'StorageFee',
    'SubscriptionFee': 'SubscriptionFee',
    'InboundFee': 'InboundFee',
    'ReturnFee': 'ReturnFee',
    'Other': 'Other',
  };
  return typeMap[type] || 'Other';
}

// 导出Excel报表
export function exportProfitReport(
  skuRows: any[],
  sharedFees: SharedFee[],
  reconciliation: any,
  storeName: string,
  month: string
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet1: SKU利润表
  const ws1Data: (string | number)[][] = [
    [`${storeName} ${month} SKU利润表`],
    [],
    [
      'SKU', 'ASIN', '订单量', '退款量', '净销售量',
      '总销售额', '退款额', '净销售额',
      '总佣金', '退款佣金', '净佣金',
      '总FBA费', '退款FBA费', '净FBA费',
      '仓储费', '广告费', '入库配置费', '退货处理费',
      '订阅费(均摊)', '其他费用(均摊)',
      '费用总计', 'SKU净收入', '利润率(%)',
    ],
  ];

  for (const row of skuRows) {
    ws1Data.push([
      row.sku, row.asin,
      row.orderQuantity, row.refundQuantity, row.orderQuantity - row.refundQuantity,
      row.grossSales, row.refundAmount, row.netSales,
      row.grossCommission, row.refundCommission, row.netCommission,
      row.grossFBAFee, row.refundFBAFee, row.netFBAFee,
      row.storageFee, row.adFee, row.inboundFee, row.returnFee,
      row.subscriptionFee, row.otherFee,
      row.totalFee, row.netIncome,
      (row.profitMargin * 100).toFixed(2),
    ]);
  }

  // 汇总行
  const totals = calculateTotals(skuRows);
  ws1Data.push([]);
  ws1Data.push([
    '合计', '', totals.orderQuantity, totals.refundQuantity, totals.orderQuantity - totals.refundQuantity,
    totals.grossSales, totals.refundAmount, totals.netSales,
    totals.grossCommission, totals.refundCommission, totals.netCommission,
    totals.grossFBAFee, totals.refundFBAFee, totals.netFBAFee,
    totals.storageFee, totals.adFee, totals.inboundFee, totals.returnFee,
    totals.subscriptionFee, totals.otherFee,
    totals.totalFee, totals.netIncome, '',
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  // 设置列宽
  ws1['!cols'] = ws1Data[2].map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws1, 'SKU利润表');

  // Sheet2: 共享费用
  const ws2Data: (string | number)[][] = [
    [`${storeName} ${month} 共享费用`],
    [],
    ['费用类别', '金额', '描述'],
  ];
  for (const fee of sharedFees) {
    ws2Data.push([fee.category, fee.totalAmount, fee.description]);
  }
  ws2Data.push([]);
  ws2Data.push(['合计', sharedFees.reduce((s, f) => s + f.totalAmount, 0), '']);
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, '共享费用');

  // Sheet3: 全局收支核对
  const ws3Data: (string | number)[][] = [
    [`${storeName} ${month} 全局收支核对`],
    [],
    ['项目', '金额'],
    ['SKU净收入汇总', reconciliation.skuNetIncome],
    ['共享费用汇总', reconciliation.sharedFeeTotal],
    ['净收入', reconciliation.totalNetIncome],
    ['原始账单总计', reconciliation.grandTotalFromBill],
    ['差异', reconciliation.difference],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
  ws3['!cols'] = [{ wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, '全局收支核对');

  return wb;
}

function calculateTotals(rows: any[]) {
  const keys = [
    'orderQuantity', 'refundQuantity', 'grossSales', 'refundAmount', 'netSales',
    'grossCommission', 'refundCommission', 'netCommission',
    'grossFBAFee', 'refundFBAFee', 'netFBAFee',
    'storageFee', 'adFee', 'inboundFee', 'returnFee',
    'subscriptionFee', 'otherFee', 'totalFee', 'netIncome',
  ];
  const totals: Record<string, number> = {};
  for (const key of keys) {
    totals[key] = Math.round(rows.reduce((s: number, r: any) => s + (r[key] || 0), 0) * 100) / 100;
  }
  return totals;
}