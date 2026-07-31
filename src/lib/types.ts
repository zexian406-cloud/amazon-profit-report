// 交易类型
export type TransactionType =
  | 'Order'           // 订单
  | 'Refund'          // 退款
  | 'Adjustment'      // 调整
  | 'FBAFee'          // FBA费用
  | 'SubscriptionFee' // 订阅费
  | 'StorageFee'      // 仓储费
  | 'AdFee'           // 广告费
  | 'InboundFee'      // 入库配置费
  | 'ReturnFee'       // 退货处理费
  | 'Other';          // 其他

// 原始交易记录
export interface Transaction {
  id?: number;
  date: string;
  type: TransactionType;
  sku: string;
  asin: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  orderId: string;
  storeName: string;   // 店铺名称
  category: string;    // 费用类别
  rawRow: Record<string, string>; // 原始行数据
}

// 导入的月数据
export interface MonthlyData {
  id?: number;
  month: string;       // YYYY-MM
  storeName: string;   // 店铺名称
  importDate: string;  // 导入时间
  fileName: string;    // 文件名
  transactions: Transaction[];
}

// SKU利润汇总
export interface SKUProfitRow {
  sku: string;
  asin: string;
  storeName: string;
  month: string;
  // 订单量
  orderQuantity: number;
  refundQuantity: number;
  // 销售额
  grossSales: number;
  refundAmount: number;
  netSales: number;
  // 佣金
  grossCommission: number;
  refundCommission: number;
  netCommission: number;
  // FBA费
  grossFBAFee: number;
  refundFBAFee: number;
  netFBAFee: number;
  // 其他费用
  storageFee: number;
  adFee: number;
  inboundFee: number;
  returnFee: number;
  subscriptionFee: number; // 均摊
  otherFee: number;        // 均摊
  // 汇总
  totalFee: number;
  netIncome: number;
  profitMargin: number;    // 百分比
}

// 共享费用（无法归属到单个SKU的费用）
export interface SharedFee {
  id?: number;
  month: string;
  storeName: string;
  category: string;    // 如: 广告费, Vine注册费, 订阅费, 其他
  totalAmount: number;
  description: string;
}

// 全局收支核对
export interface Reconciliation {
  month: string;
  storeName: string;
  skuNetIncome: number;       // SKU净收入汇总
  sharedFeeTotal: number;     // 共享费用汇总
  totalNetIncome: number;     // 净收入 = SKU净收入 - 共享费用
  grandTotalFromBill: number; // 原始账单总计
  difference: number;         // 差异
}

// 历史月数据
export interface HistoryMonth {
  month: string;
  storeName: string;
  totalSales: number;
  totalNetIncome: number;
  profitMargin: number;
  skuCount: number;
}

// 解析结果
export interface ParseResult {
  month: string;
  storeName: string;
  transactions: Transaction[];
  sharedFees: SharedFee[];
  reconciliation: Reconciliation | null;
}

// 店铺配置
export interface StoreConfig {
  id?: number;
  name: string;
  currency: string;
  subscriptionFee: number;    // 月订阅费
  otherSharedFees: number;    // 其他共享费用
}

export const DEFAULT_STORES: StoreConfig[] = [
  { name: '一店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
  { name: '二店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
  { name: '三店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
];

// 费用类型映射
export const FEE_CATEGORY_MAP: Record<string, string> = {
  '广告费': 'AdFee',
  '广告': 'AdFee',
  '广告费用': 'AdFee',
  '入库配置费': 'InboundFee',
  '入库配置': 'InboundFee',
  '退货处理费': 'ReturnFee',
  '退货处理': 'ReturnFee',
  '仓储费': 'StorageFee',
  '仓储': 'StorageFee',
  'FBA仓储费': 'StorageFee',
  '月仓储费': 'StorageFee',
  '订阅费': 'SubscriptionFee',
  '月服务费': 'SubscriptionFee',
  '专业销售计划': 'SubscriptionFee',
  'Vine注册费': 'Other',
  'Vine': 'Other',
};