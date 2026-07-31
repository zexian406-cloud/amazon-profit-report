import { Transaction, SKUProfitRow, SharedFee, Reconciliation, StorageFeeItem, AdReportItem, ReturnReportItem, SettlementReport, ProductCostItem, DeliveryFeeItem, ManagerMapping } from './types';

export function calculateSKUProfit(
  transactions: Transaction[],
  sharedFees: SharedFee[],
  month: string,
  storeName: string,
  defaultManager: string = '',
  managerMappings?: ManagerMapping[],
): { skuRows: SKUProfitRow[]; reconciliation: Reconciliation } {
  return calculateSKUProfitWithReports(
    transactions, sharedFees, month, storeName,
    undefined, undefined, undefined, undefined, undefined, undefined,
    defaultManager, managerMappings,
  );
}

// 描述关键词匹配辅助
function descContains(desc: string, ...keywords: string[]): boolean {
  const d = desc.toLowerCase();
  return keywords.some(k => d.includes(k));
}

/**
 * 多报表合并利润计算 - 41列模板
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
  productCostItems?: ProductCostItem[],
  deliveryFeeItems?: DeliveryFeeItem[],
  defaultManager: string = '',
  managerMappings?: ManagerMapping[],
): { skuRows: SKUProfitRow[]; reconciliation: Reconciliation } {
  // 构建SKU→负责人映射
  const managerMap = new Map<string, string>();
  if (managerMappings) {
    for (const m of managerMappings) {
      if (m.sku) managerMap.set(m.sku.trim().toUpperCase(), m.manager);
    }
  }
  const skuGroups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = `${t.sku}|${t.asin}`;
    if (!skuGroups.has(key)) {
      skuGroups.set(key, []);
    }
    skuGroups.get(key)!.push(t);
  }

  // 构建外部数据映射
  const storageFeeBySKU = new Map<string, number>();
  if (storageFeeItems) {
    for (const item of storageFeeItems) {
      const current = storageFeeBySKU.get(item.sku) || 0;
      storageFeeBySKU.set(item.sku, current + item.storageFee);
    }
  }

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

  const returnBySKU = new Map<string, { quantity: number; amount: number }>();
  if (returnReportItems) {
    for (const item of returnReportItems) {
      const current = returnBySKU.get(item.sku) || { quantity: 0, amount: 0 };
      current.quantity += item.returnQuantity;
      current.amount += Math.abs(item.refundAmount);
      returnBySKU.set(item.sku, current);
    }
  }

  const productCostBySKU = new Map<string, number>();
  if (productCostItems) {
    for (const item of productCostItems) {
      productCostBySKU.set(item.sku, item.fobCost);
    }
  }

  const deliveryFeeBySKU = new Map<string, number>();
  let legangTotal = 0;
  let jingdongTotal = 0;
  if (deliveryFeeItems) {
    for (const item of deliveryFeeItems) {
      const current = deliveryFeeBySKU.get(item.sku) || 0;
      deliveryFeeBySKU.set(item.sku, current + item.deliveryFee);
      if (item.carrier.toLowerCase().includes('legang') || item.carrier.toLowerCase().includes('乐歌')) {
        legangTotal += item.deliveryFee;
      } else if (item.carrier.toLowerCase().includes('jingdong') || item.carrier.toLowerCase().includes('京东')) {
        jingdongTotal += item.deliveryFee;
      }
    }
  }

  const skuRows: SKUProfitRow[] = [];

  for (const [key, txns] of skuGroups) {
    const [sku, asin] = key.split('|');

    // 按类型分组
    const orders = txns.filter(t => t.type === 'Order');
    const refunds = txns.filter(t => t.type === 'Refund');
    const adjustments = txns.filter(t => t.type === 'Adjustment');
    const fbaFees = txns.filter(t => t.type === 'FBAFee');
    const storageFees = txns.filter(t => t.type === 'StorageFee');
    const adFees = txns.filter(t => t.type === 'AdFee');
    const inboundFees = txns.filter(t => t.type === 'InboundFee');
    const returnFees = txns.filter(t => t.type === 'ReturnFee');
    const couponFees = txns.filter(t => t.type === 'CouponFee');
    const liquidationFees = txns.filter(t => t.type === 'LiquidationFee');
    const inventoryComps = txns.filter(t => t.type === 'InventoryCompensation');
    const safeTClaims = txns.filter(t => t.type === 'SafeTClaim');
    const disposalFees = txns.filter(t => t.type === 'DisposalFee');
    const removalFees = txns.filter(t => t.type === 'RemovalFee');
    const otherFees = txns.filter(t => t.type === 'Other');

    const orderQuantity = orders.reduce((s, t) => s + t.quantity, 0);
    const refundQuantity = Math.abs(refunds.reduce((s, t) => s + t.quantity, 0));

    // ====== 收入部分 ======

    // 商品销售收入：从订单中提取，排除运费
    const productSales = Math.round(orders
      .filter(t => !descContains(t.description, 'shipping', '运费', 'delivery', 'liquidation', '清算'))
      .reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;

    // 运费收入
    const shippingIncome = Math.round(orders
      .filter(t => descContains(t.description, 'shipping', '运费', 'delivery'))
      .reduce((s, t) => s + t.totalAmount, 0) * 100) / 100;

    // 清算残值收入
    const liquidationValue = Math.round(
      orders
        .filter(t => descContains(t.description, 'liquidation', '清算', '清货'))
        .reduce((s, t) => s + t.totalAmount, 0) * 100
    ) / 100;

    // 退款-商品
    const refundProduct = Math.round(Math.abs(refunds
      .filter(t => !descContains(t.description, 'shipping', '运费', 'delivery', 'promo', '促销', '优惠'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 退款-运费
    const refundShipping = Math.round(Math.abs(refunds
      .filter(t => descContains(t.description, 'shipping', '运费', 'delivery'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 退款-促销回冲
    const refundPromo = Math.round(Math.abs(refunds
      .filter(t => descContains(t.description, 'promo', '促销', '优惠', '折扣'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 促销折扣
    const promoDiscount = Math.round(Math.abs(adjustments
      .filter(t => descContains(t.description, 'promo', '促销', '折扣', '优惠'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 净销售额 = 商品销售收入 + 运费收入 + 清算残值收入 - 退款-商品 - 退款-运费 - 退款-促销回冲 - 促销折扣
    const netSales = Math.round((productSales + shippingIncome + liquidationValue - refundProduct - refundShipping - refundPromo - promoDiscount) * 100) / 100;

    // ====== 佣金部分 ======

    // 销售佣金：从Order中提取佣金部分
    const salesCommission = Math.round(Math.abs(orders
      .filter(t => descContains(t.description, 'commission', '佣金', 'referral'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 退款-佣金退回
    const refundCommission = Math.round(Math.abs(refunds
      .filter(t => descContains(t.description, 'commission', '佣金', 'referral'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // Coupon费
    const couponFee = Math.round(Math.abs(couponFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 净佣金 = 销售佣金 - 退款-佣金退回 + Coupon费
    // 注意：佣金是支出（负值），退款佣金退回是收入（正值）
    const netCommission = Math.round((-salesCommission + refundCommission + couponFee) * 100) / 100;

    // ====== FBA费用部分 ======

    // FBA配送费
    const fbaDeliveryFee = Math.round(Math.abs(fbaFees
      .filter(t => descContains(t.description, 'shipping', '配送', '运费', 'delivery'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 退款-FBA费退回
    const refundFBAFee = Math.round(Math.abs(refunds
      .filter(t => descContains(t.description, 'fba', 'fulfillment', '配送'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 退货处理费
    const returnFee = Math.round(Math.abs(returnFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 入库异常费
    const inboundAbnormalFee = Math.round(Math.abs(inboundFees
      .filter(t => descContains(t.description, 'abnormal', '异常', 'inbound'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 净FBA费 = FBA配送费 - 退款FBA费退回 + 退货处理费 + 入库异常费
    const netFBAFee = Math.round((-fbaDeliveryFee + refundFBAFee - returnFee - inboundAbnormalFee) * 100) / 100;

    // ====== 仓储费部分 ======

    // 月度仓储费（普通仓储费）
    const txnMonthlyStorage = Math.abs(storageFees
      .filter(t => !descContains(t.description, 'aged', '超龄', '长期'))
      .reduce((s, t) => s + t.totalAmount, 0));

    // 超龄附加费
    const txnAgedSurcharge = Math.abs(storageFees
      .filter(t => descContains(t.description, 'aged', '超龄', '长期'))
      .reduce((s, t) => s + t.totalAmount, 0));

    // 合并仓储费报告数据
    let reportStorageFee = storageFeeBySKU.get(sku) || 0;

    // 如果有仓储费报告，用它替换
    let monthlyStorageFee: number;
    let agedSurcharge: number;
    let storageFeeSource: string;

    if (reportStorageFee > 0) {
      monthlyStorageFee = Math.round(reportStorageFee * 100) / 100;
      agedSurcharge = Math.round(txnAgedSurcharge * 100) / 100;
      storageFeeSource = 'storage_report';
    } else {
      monthlyStorageFee = Math.round(txnMonthlyStorage * 100) / 100;
      agedSurcharge = Math.round(txnAgedSurcharge * 100) / 100;
      storageFeeSource = 'transaction';
    }

    // 如果两者都有，合并
    if (reportStorageFee > 0 && txnMonthlyStorage > 0) {
      monthlyStorageFee = Math.round((reportStorageFee + txnMonthlyStorage) * 100) / 100;
      storageFeeSource = 'merged';
    }

    const totalStorageFee = Math.round((monthlyStorageFee + agedSurcharge) * 100) / 100;

    // ====== 其他费用 ======

    const liquidationFeeVal = Math.round(Math.abs(liquidationFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;
    const inventoryCompensationVal = Math.round(Math.abs(inventoryComps.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;
    const safeTClaimVal = Math.round(Math.abs(safeTClaims.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 退款-其他：退款中不属于商品/运费/促销的部分
    const refundOther = Math.round(Math.abs(refunds
      .filter(t => {
        const d = t.description.toLowerCase();
        return !descContains(d, 'shipping', '运费', 'delivery', 'promo', '促销', '优惠', '折扣', 'commission', '佣金', 'referral', 'fba', 'fulfillment', '配送');
      })
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 退货运费（从returnFee中提取运费相关）
    const returnShippingFee = Math.round(Math.abs(returnFees
      .filter(t => descContains(t.description, 'shipping', '运费', 'delivery'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    const disposalFeeVal = Math.round(Math.abs(disposalFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 入库配置费
    const inboundFee = Math.round(Math.abs(inboundFees
      .filter(t => !descContains(t.description, 'abnormal', '异常'))
      .reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    const removalFeeVal = Math.round(Math.abs(removalFees.reduce((s, t) => s + t.totalAmount, 0)) * 100) / 100;

    // 广告费
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
    if (reportAdFee !== undefined && reportAdFee > 0 && txnAdFee > 0) {
      adFee = Math.round((reportAdFee + txnAdFee) * 100) / 100;
      adFeeSource = 'merged';
    }

    // 产品成本
    const reportProductCost = productCostBySKU.get(sku);
    let productCost: number;
    let productCostSource: string;
    if (reportProductCost !== undefined && reportProductCost > 0) {
      productCost = Math.round(reportProductCost * orderQuantity * 100) / 100;
      productCostSource = 'product_cost_report';
    } else {
      productCost = 0;
      productCostSource = 'transaction';
    }

    // 尾程运费（按配送商拆分）
    const reportDeliveryFee = deliveryFeeBySKU.get(sku);
    let deliveryFeeSource: string;
    let legangDelivery = 0;
    let jingdongDelivery = 0;
    if (reportDeliveryFee !== undefined && reportDeliveryFee > 0) {
      // 按比例分配
      const totalDelivery = reportDeliveryFee;
      const totalAll = legangTotal + jingdongTotal + 1; // +1 避免除零
      legangDelivery = Math.round((totalDelivery * legangTotal / totalAll) * 100) / 100;
      jingdongDelivery = Math.round((totalDelivery * jingdongTotal / totalAll) * 100) / 100;
      deliveryFeeSource = 'delivery_fee_report';
    } else {
      legangDelivery = 0;
      jingdongDelivery = 0;
      deliveryFeeSource = 'transaction';
    }

    // 其他调整（均摊前）
    const otherAdjustment = 0;
    // 订阅费（均摊前）
    const subscriptionFee = 0;
    // 头程（默认0，从头程报告导入）
    const headHaul = 0;
    // 刷单费
    const fakeOrderFee = 0;

    // 净收入计算
    // 净收入 = 净销售额 + 净佣金 + 净FBA费 - 仓储费合计 - 其他费用 - 外部成本
    const otherFeesTotal = liquidationFeeVal + inventoryCompensationVal + safeTClaimVal + refundOther + returnShippingFee + disposalFeeVal + inboundFee + removalFeeVal + subscriptionFee + otherAdjustment + fakeOrderFee;
    const externalCosts = adFee + headHaul + productCost + legangDelivery + jingdongDelivery;

    // 注意：净佣金和净FBA费已经是负数（支出）
    // 净销售额是正数，净佣金是负数（支出），净FBA费是负数（支出）
    // 仓储费合计是正数（支出），其他费用是正数（支出），外部成本是正数（支出）
    const netIncome = Math.round((netSales + netCommission + netFBAFee - totalStorageFee - otherFeesTotal - externalCosts) * 100) / 100;

    const profitMargin = netSales !== 0 ? Math.round((netIncome / netSales) * 10000) / 10000 : 0;

    skuRows.push({
      sku,
      asin,
      storeName,
      month,
      orderQuantity,
      refundQuantity,
      productSales,
      shippingIncome,
      liquidationValue,
      refundProduct,
      refundShipping,
      refundPromo,
      promoDiscount,
      netSales,
      salesCommission,
      refundCommission,
      couponFee,
      netCommission,
      fbaDeliveryFee,
      refundFBAFee,
      returnFee,
      inboundAbnormalFee,
      netFBAFee,
      monthlyStorageFee,
      agedSurcharge,
      totalStorageFee,
      liquidationFee: liquidationFeeVal,
      inventoryCompensation: inventoryCompensationVal,
      safeTClaim: safeTClaimVal,
      refundOther,
      returnShippingFee,
      disposalFee: disposalFeeVal,
      subscriptionFee,
      otherAdjustment,
      inboundFee,
      removalFee: removalFeeVal,
      adFee,
      headHaul,
      productCost,
      legangDelivery,
      jingdongDelivery,
      fakeOrderFee,
      netIncome,
      profitMargin,
      manager: managerMap.get(sku.toUpperCase()) || defaultManager || '',
      dataSources: {
        storageFee: storageFeeSource,
        adFee: adFeeSource,
        returnFee: 'transaction',
        productCost: productCostSource,
        deliveryFee: deliveryFeeSource,
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
      row.otherAdjustment = perSKUOther;

      // 重新计算净收入
      const otherFeesTotal = row.liquidationFee + row.inventoryCompensation + row.safeTClaim + row.refundOther + row.returnShippingFee + row.disposalFee + row.inboundFee + row.removalFee + row.subscriptionFee + row.otherAdjustment + row.fakeOrderFee;
      const externalCosts = row.adFee + row.headHaul + row.productCost + row.legangDelivery + row.jingdongDelivery;

      row.netIncome = Math.round((row.netSales + row.netCommission + row.netFBAFee - row.totalStorageFee - otherFeesTotal - externalCosts) * 100) / 100;
      row.profitMargin = row.netSales !== 0 ? Math.round((row.netIncome / row.netSales) * 10000) / 10000 : 0;
    }
  }

  // 生成收支核对
  const skuNetIncome = Math.round(skuRows.reduce((s, r) => s + r.netIncome, 0) * 100) / 100;
  const sharedFeeTotal = Math.round(sharedFees.reduce((s, f) => s + f.totalAmount, 0) * 100) / 100;
  const totalNetIncome = Math.round((skuNetIncome + sharedFeeTotal) * 100) / 100;

  const grandTotalFromBill = Math.round(
    transactions.reduce((s, t) => s + t.totalAmount, 0) +
    sharedFees.reduce((s, f) => s + f.totalAmount, 0)
  ) / 100;

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