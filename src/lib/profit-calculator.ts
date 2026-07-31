import { Transaction, SKUProfitRow, SharedFee, Reconciliation } from './types';

export function calculateSKUProfit(
  transactions: Transaction[],
  sharedFees: SharedFee[],
  month: string,
  storeName: string
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

    // 佣金（从订单和退款中分离）
    // 在亚马逊报告中，佣金通常包含在交易金额中
    // 实际应按比例估算，这里简化处理
    const commissionRatio = 0.15; // 假设平均佣金率15%
    const grossCommission = Math.round(grossSales * commissionRatio * 100) / 100;
    const refundCommission = Math.round(Math.abs(refundAmount) * commissionRatio * 100) / 100;
    const netCommission = Math.round((grossCommission - refundCommission) * 100) / 100;

    // FBA费
    const grossFBAFee = Math.round(fbaFees.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;
    const refundFBAFee = Math.round(Math.abs(refunds.filter(t => t.description.toLowerCase().includes('fba')).reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;
    const netFBAFee = Math.round((grossFBAFee + refundFBAFee) * 100) / 100;

    // 仓储费
    const storageFee = Math.round(storageFees.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;

    // 广告费
    const adFee = Math.round(adFees.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;

    // 入库配置费
    const inboundFee = Math.round(inboundFees.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;

    // 退货处理费
    const returnFee = Math.round(returnFees.reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;

    // 其他费用（调整等）
    const otherSkuFee = Math.round((adjustments.reduce((s, t) => s + t.totalAmount, 0) + otherFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 订阅费和均摊费用将在后续处理
    const subscriptionFee = 0;
    const otherFee = 0;

    // 费用总计
    const totalFee = Math.round((
      Math.abs(netCommission) +
      Math.abs(netFBAFee) +
      Math.abs(storageFee) +
      Math.abs(adFee) +
      Math.abs(inboundFee) +
      Math.abs(returnFee) +
      Math.abs(subscriptionFee) +
      Math.abs(otherFee) +
      Math.abs(otherSkuFee)
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
        Math.abs(row.storageFee) +
        Math.abs(row.adFee) +
        Math.abs(row.inboundFee) +
        Math.abs(row.returnFee) +
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

  const reconciliation: Reconciliation = {
    month,
    storeName,
    skuNetIncome,
    sharedFeeTotal,
    totalNetIncome,
    grandTotalFromBill: Math.round(grandTotalFromBill * 100) / 100,
    difference: Math.round((grandTotalFromBill - totalNetIncome) * 100) / 100,
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