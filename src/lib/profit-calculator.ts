import { Transaction, SKUProfitRow, SharedFee, Reconciliation, StorageFeeItem, AdReportItem, ReturnReportItem, SettlementReport } from './types';

export function calculateSKUProfit(
  transactions: Transaction[],
  sharedFees: SharedFee[],
  month: string,
  storeName: string
): { skuRows: SKUProfitRow[]; reconciliation: Reconciliation } {
  return calculateSKUProfitWithReports(
    transactions, sharedFees, month, storeName,
    undefined, undefined, undefined, undefined
  );
}

/**
 * 多报表合并利润计算
 * 支持将仓储费报告、广告报告、退货报告的数据与交易明细合并
 */
export function calculateSKUProfitWithReports(
  transactions: Transaction[],
  sharedFees: SharedFee[],
  month: string,
  storeName: string,
  storageFeeItems?: StorageFeeItem[],
  adReportItems?: AdReportItem[],
  returnReportItems?: ReturnReportItem[],
  settlementReport?: SettlementReport,
): { skuRows: SKUProfitRow[]; reconciliation: Reconciliation } {
  // 按SKU分组
  const skuGroups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = `${t.sku}|${t.asin}`;
    if (!skuGroups.has(key)) {
      skuGroups.set(key, []);
    }
    skuGroups.get(key)!.push(t);
  }

  // 构建SKU→仓储费映射（来自仓储费报告）
  const storageFeeBySKU = new Map<string, number>();
  if (storageFeeItems) {
    for (const item of storageFeeItems) {
      const current = storageFeeBySKU.get(item.sku) || 0;
      storageFeeBySKU.set(item.sku, current + item.storageFee);
    }
  }

  // 构建SKU→广告费映射（来自广告报告）
  const adFeeBySKU = new Map<string, number>();
  let totalAdSpendNoSKU = 0;
  if (adReportItems) {
    for (const item of adReportItems) {
      if (item.sku && item.sku !== 'N/A' && item.sku !== '') {
        const current = adFeeBySKU.get(item.sku) || 0;
        adFeeBySKU.set(item.sku, current + item.spend);
      } else {
        totalAdSpendNoSKU += item.spend;
      }
    }
  }

  // 构建SKU→退货映射（来自退货报告）
  const returnBySKU = new Map<string, { quantity: number; amount: number }>();
  if (returnReportItems) {
    for (const item of returnReportItems) {
      const current = returnBySKU.get(item.sku) || { quantity: 0, amount: 0 };
      current.quantity += item.returnQuantity;
      current.amount += Math.abs(item.refundAmount);
      returnBySKU.set(item.sku, current);
    }
  }

  const skuRows: SKUProfitRow[] = [];

  for (const [key, txns] of skuGroups) {
    const [sku, asin] = key.split('|');

    // 订单
    const orders = txns.filter(t => t.type === 'Order');
    const refunds = txns.filter(t => t.type === 'Refund');
    const adjustments = txns.filter(t => t.type === 'Adjustment');
    const fbaFees = txns.filter(t => t.type === 'FBAFee');
    const storageFees = txns.filter(t => t.type === 'StorageFee');
    const adFees = txns.filter(t => t.type === 'AdFee');
    const inboundFees = txns.filter(t => t.type === 'InboundFee');
    const returnFees = txns.filter(t => t.type === 'ReturnFee');
    const otherFees = txns.filter(t => t.type === 'Other');

    const orderQuantity = orders.reduce((s, t) => s + t.quantity, 0);
    const refundQuantity = Math.abs(refunds.reduce((s, t) => s + t.quantity, 0));

    // 销售额
    const grossSales = Math.round(orders.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;
    const refundAmount = Math.round(refunds.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;
    const netSales = Math.round((grossSales + refundAmount) * 100) / 100;

    // 佣金
    const commissionRatio = 0.15;
    const grossCommission = Math.round(grossSales * commissionRatio * 100) / 100;
    const refundCommission = Math.round(Math.abs(refundAmount) * commissionRatio * 100) / 100;
    const netCommission = Math.round((grossCommission - refundCommission) * 100) / 100;

    // FBA费
    const grossFBAFee = Math.round(fbaFees.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;
    const refundFBAFee = Math.round(Math.abs(refunds.filter(t => t.description.toLowerCase().includes('fba')).reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;
    const netFBAFee = Math.round((grossFBAFee + refundFBAFee) * 100) / 100;

    // ====== 多报表数据合并 ======

    // 仓储费：优先使用仓储费报告数据，否则用交易明细数据
    let storageFee: number;
    let storageFeeSource: string;
    const reportStorageFee = storageFeeBySKU.get(sku);
    const txnStorageFee = Math.round(Math.abs(storageFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    if (reportStorageFee !== undefined && reportStorageFee > 0) {
      storageFee = Math.round(reportStorageFee * 100) / 100;
      storageFeeSource = 'storage_report';
    } else if (txnStorageFee > 0) {
      storageFee = txnStorageFee;
      storageFeeSource = 'transaction';
    } else {
      // 合并：两者都有则相加
      storageFee = txnStorageFee;
      storageFeeSource = 'transaction';
    }
    // 如果两者都有，取较大值或相加（这里取相加，表示总仓储费）
    if (reportStorageFee !== undefined && reportStorageFee > 0 && txnStorageFee > 0) {
      storageFee = Math.round((reportStorageFee + txnStorageFee) * 100) / 100;
      storageFeeSource = 'merged';
    }

    // 广告费：优先使用广告报告数据，否则用交易明细
    let adFee: number;
    let adFeeSource: string;
    const reportAdFee = adFeeBySKU.get(sku);
    const txnAdFee = Math.round(Math.abs(adFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    if (reportAdFee !== undefined && reportAdFee > 0) {
      adFee = Math.round(reportAdFee * 100) / 100;
      adFeeSource = 'ad_report';
    } else if (txnAdFee > 0) {
      adFee = txnAdFee;
      adFeeSource = 'transaction';
    } else {
      adFee = 0;
      adFeeSource = 'transaction';
    }
    // 合并
    if (reportAdFee !== undefined && reportAdFee > 0 && txnAdFee > 0) {
      adFee = Math.round((reportAdFee + txnAdFee) * 100) / 100;
      adFeeSource = 'merged';
    }

    // 退货处理费：优先使用退货报告数据
    let returnFee: number;
    let returnFeeSource: string;
    const reportReturn = returnBySKU.get(sku);
    const txnReturnFee = Math.round(Math.abs(returnFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    if (reportReturn && reportReturn.amount > 0) {
      returnFee = Math.round(reportReturn.amount * 100) / 100;
      returnFeeSource = 'return_report';
    } else if (txnReturnFee > 0) {
      returnFee = txnReturnFee;
      returnFeeSource = 'transaction';
    } else {
      returnFee = 0;
      returnFeeSource = 'transaction';
    }
    if (reportReturn && reportReturn.amount > 0 && txnReturnFee > 0) {
      returnFee = Math.round((reportReturn.amount + txnReturnFee) * 100) / 100;
      returnFeeSource = 'merged';
    }

    // 入库配置费
    const inboundFee = Math.round(Math.abs(inboundFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 其他费用（调整等）
    const otherSkuFee = Math.round(Math.abs(adjustments.reduce((s, t) => s + t.totalAmount, 0) + otherFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 订阅费和均摊费用将在后续处理
    const subscriptionFee = 0;
    const otherFee = 0;

    // 费用总计（不含均摊）
    const totalFee = Math.round((
      Math.abs(netCommission) +
      Math.abs(netFBAFee) +
      storageFee +
      adFee +
      Math.abs(inboundFee) +
      returnFee +
      Math.abs(subscriptionFee) +
      Math.abs(otherFee) +
      otherSkuFee
    ) * 100) / 100;

    // 净收入
    const netIncome = Math.round((netSales - totalFee) * 100) / 100;

    // 利润率
    const profitMargin = netSales !== 0
      ? Math.round((netIncome / netSales) * 10000) / 10000
      : 0;

    skuRows.push({
      sku,
      asin,
      storeName,
      month,
      orderQuantity,
      refundQuantity,
      grossSales,
      refundAmount,
      netSales,
      grossCommission,
      refundCommission,
      netCommission,
      grossFBAFee,
      refundFBAFee,
      netFBAFee,
      storageFee,
      adFee,
      inboundFee,
      returnFee,
      subscriptionFee,
      otherFee,
      totalFee,
      netIncome,
      profitMargin,
      dataSources: {
        storageFee: storageFeeSource,
        adFee: adFeeSource,
        returnFee: returnFeeSource,
      },
    });
  }

  // 均摊共享费用
  const skuCount = skuRows.length;
  if (skuCount > 0) {
    const subscriptionFeeTotal = sharedFees
      .filter(f => f.category === 'SubscriptionFee')
      .reduce((s, f) => s + f.totalAmount, 0);

    const otherFeeTotal = sharedFees
      .filter(f => f.category !== 'SubscriptionFee' && f.category !== 'AdFee')
      .reduce((s, f) => s + f.totalAmount, 0);

    const perSKUSubscription = Math.round((subscriptionFeeTotal / skuCount) * 100) / 100;
    const perSKUOther = Math.round((otherFeeTotal / skuCount) * 100) / 100;

    for (const row of skuRows) {
      row.subscriptionFee = perSKUSubscription;
      row.otherFee = perSKUOther;

      // 重新计算费用总计和净收入
      row.totalFee = Math.round((
        Math.abs(row.netCommission) +
        Math.abs(row.netFBAFee) +
        row.storageFee +
        row.adFee +
        Math.abs(row.inboundFee) +
        row.returnFee +
        Math.abs(row.subscriptionFee) +
        Math.abs(row.otherFee)
      ) * 100) / 100;

      row.netIncome = Math.round((row.netSales - row.totalFee) * 100) / 100;
      row.profitMargin = row.netSales !== 0
        ? Math.round((row.netIncome / row.netSales) * 10000) / 10000
        : 0;
    }
  }

  // 生成收支核对
  const skuNetIncome = Math.round(skuRows.reduce((s, r) => s + r.netIncome, 0) * 100) / 100;
  const sharedFeeTotal = Math.round(sharedFees.reduce((s, f) => s + f.totalAmount, 0) * 100) / 100;
  const totalNetIncome = Math.round((skuNetIncome + sharedFeeTotal) * 100) / 100;

  // 原始账单总额
  const grandTotalFromBill = Math.round(
    transactions.reduce((s, t) => s + t.totalAmount, 0) +
    sharedFees.reduce((s, f) => s + f.totalAmount, 0)
  ) / 100;

  // 如果有结算报告，进行交叉验证
  let settlementTotal: number | undefined;
  let settlementDiff: number | undefined;
  if (settlementReport) {
    settlementTotal = settlementReport.totalAmount;
    settlementDiff = Math.round((totalNetIncome - settlementTotal) * 100) / 100;
  }

  const reconciliation: Reconciliation = {
    month,
    storeName,
    skuNetIncome,
    sharedFeeTotal,
    totalNetIncome,
    grandTotalFromBill: Math.round(grandTotalFromBill * 100) / 100,
    difference: Math.round((grandTotalFromBill - totalNetIncome) * 100) / 100,
    settlementTotal,
    settlementDiff,
  };

  return { skuRows, reconciliation };
}

// 获取月度趋势数据
export function getMonthlyTrends(allReports: SKUProfitRow[]): {
  months: string[];
  salesData: number[];
  incomeData: number[];
  marginData: number[];
} {
  const monthMap = new Map<string, { sales: number; income: number; margin: number[] }>();

  for (const row of allReports) {
    if (!monthMap.has(row.month)) {
      monthMap.set(row.month, { sales: 0, income: 0, margin: [] });
    }
    const data = monthMap.get(row.month)!;
    data.sales += row.netSales;
    data.income += row.netIncome;
    data.margin.push(row.profitMargin);
  }

  const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return {
    months: sorted.map(([m]) => m),
    salesData: sorted.map(([, d]) => Math.round(d.sales * 100) / 100),
    incomeData: sorted.map(([, d]) => Math.round(d.income * 100) / 100),
    marginData: sorted.map(([, d]) => {
      const avg = d.margin.reduce((s, m) => s + m, 0) / d.margin.length;
      return Math.round(avg * 10000) / 10000;
    }),
  };
}