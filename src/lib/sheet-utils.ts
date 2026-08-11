import { TransactionType } from './types';

// ====== 共享的列名标准化 ======

export function normalizeHeader(header: string): string {
  const map: Record<string, string> = {
    'date': 'date', '日期': 'date', 'transaction-date': 'date', 'transactiondate': 'date',
    'settlement-date': 'date', 'settlementdate': 'date', 'posted-date': 'date', 'posteddate': 'date',
    'date/time': 'date', 'datetime': 'date', 'date-time': 'date',
    'sku': 'sku', 'SKU': 'sku',
    'asin': 'asin', 'ASIN': 'asin',
    'description': 'description', '描述': 'description', 'transaction-description': 'description',
    'type': 'type', '类型': 'type', 'transaction-type': 'type', 'transactiontype': 'type',
    'amount': 'amount', '金额': 'amount', 'total': 'amount', 'total-amount': 'amount',
    'quantity': 'quantity', '数量': 'quantity', 'qty': 'quantity',
    'order-id': 'orderId', 'orderid': 'orderId', '订单号': 'orderId', 'order id': 'orderId',
    'currency': 'currency', '货币': 'currency',
    'store': 'store', '店铺': 'store', 'store-name': 'store',
    'category': 'category', '类别': 'category', '费用类别': 'category',
    '商品名称': 'productName', 'product-name': 'productName', 'productname': 'productName',
    'title': 'productName', '商品标题': 'productName',
    '负责人': 'manager', 'manager': 'manager', '责任人': 'manager', '经办人': 'manager',
    // Amazon Monthly Transaction 格式
    'product sales': 'productSales',
    'product sales tax': 'productSalesTax',
    'shipping credits': 'shippingCredits',
    'shipping credits tax': 'shippingCreditsTax',
    'gift wrap credits': 'giftWrapCredits',
    'giftwrap credits tax': 'giftWrapCreditsTax',
    'promotional rebates': 'promotionalRebates',
    'promotional rebates tax': 'promotionalRebatesTax',
    'marketplace withheld tax': 'marketplaceWithheldTax',
    'selling fees': 'sellingFees',
    'fba fees': 'fbaFees',
    'other transaction fees': 'otherTransactionFees',
    'other': 'other',
    'settlement id': 'settlementId', 'settlement-id': 'settlementId',
    'marketplace': 'marketplace',
    'fulfillment': 'fulfillment',
    'order city': 'orderCity',
    'order state': 'orderState',
    'order postal': 'orderPostal',
    'tax collection model': 'taxCollectionModel',
    'regulatory fee': 'regulatoryFee',
    'tax on regulatory fee': 'taxOnRegulatoryFee',
    'transaction status': 'transactionStatus',
    'transaction release date': 'transactionReleaseDate',
    // 仓储
    'storage-fee': 'storageFee', 'storagefee': 'storageFee',
    'monthly-storage-fee': 'storageFee', 'monthly-storagefee': 'storageFee',
    '月度仓储费': 'storageFee', '仓储费': 'storageFee',
    'volume': 'volume', 'volume-cubic-feet': 'volume', 'cubic-feet': 'volume',
    'rate': 'rate', 'storage-rate': 'rate', '费率': 'rate',
  };

  const key = header.toLowerCase().trim().replace(/[\s_-]+/g, '-');
  return map[key] || map[header] || header;
}

// ====== 金额解析 ======

export function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned) || 0;
}

// ====== 数量解析 ======

export function parseQuantity(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return parseInt(cleaned) || 0;
}

// ====== 交易类型检测 ======

export function detectTransactionType(row: Record<string, string>): TransactionType {
  const desc = (row['description'] || row['描述'] || row['Description'] || '').toLowerCase();
  const type = (row['type'] || row['类型'] || row['Type'] || '').toLowerCase();

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

  // ====== 按描述逐层判断 ======

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
