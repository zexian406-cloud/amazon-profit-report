// 交易类型
export type TransactionType =
  | 'Order'              // 订单
  | 'Refund'             // 退款
  | 'Adjustment'         // 调整
  | 'FBAFee'             // FBA费用
  | 'SubscriptionFee'    // 订阅费
  | 'StorageFee'         // 仓储费
  | 'AdFee'              // 广告费
  | 'InboundFee'         // 入库配置费
  | 'ReturnFee'          // 退货处理费
  | 'CouponFee'          // Coupon费
  | 'LiquidationFee'     // 清算手续费
  | 'InventoryCompensation' // 库存赔偿
  | 'SafeTClaim'         // SAFE-T赔付
  | 'DisposalFee'        // 弃置费
  | 'RemovalFee'         // 移除订单费
  | 'Other';             // 其他

// 报表类型
export type ReportType =
  | 'transaction'    // 交易明细
  | 'settlement'     // 结算报告
  | 'storage'        // 仓储费报告
  | 'advertising'    // 广告报告
  | 'return'         // 退货报告
  | 'productCost'    // 产品成本/FOB
  | 'deliveryFee';   // 尾程运费

// 报表类型中文名
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  transaction: '交易明细',
  settlement: '结算报告',
  storage: '仓储费报告',
  advertising: '广告报告',
  return: '退货报告',
  productCost: '产品成本/FOB',
  deliveryFee: '尾程运费',
};

// 报表类型检测特征
export interface ReportTypeFeature {
  type: ReportType;
  keywords: string[];
  requiredColumns: string[][]; // 多组可选列，匹配任一即可
  priority: number;
}

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
  storeName: string;
  category: string;
  rawRow: Record<string, string>;
}

// 导入的月数据
export interface MonthlyData {
  id?: number;
  month: string;
  storeName: string;
  importDate: string;
  fileName: string;
  transactions: Transaction[];
}

// SKU利润汇总 - 41列完整模板
export interface SKUProfitRow {
  sku: string;
  asin: string;
  storeName: string;
  month: string;
  // ========== 收入部分 ==========
  orderQuantity: number;
  refundQuantity: number;
  productSales: number;          // 商品销售收入
  shippingIncome: number;        // 运费收入
  liquidationValue: number;      // 清算残值收入
  refundProduct: number;         // 退款-商品
  refundShipping: number;        // 退款-运费
  refundPromo: number;           // 退款-促销回冲
  promoDiscount: number;         // 促销折扣
  netSales: number;              // ▶ 净销售额

  // ========== 佣金部分 ==========
  salesCommission: number;       // 销售佣金
  refundCommission: number;      // 退款-佣金退回
  couponFee: number;             // Coupon费
  netCommission: number;         // ▶ 净佣金

  // ========== FBA费用部分 ==========
  fbaDeliveryFee: number;        // FBA配送费
  refundFBAFee: number;          // 退款-FBA费退回
  returnFee: number;             // 退货处理费
  inboundAbnormalFee: number;    // 入库异常费
  netFBAFee: number;             // ▶ 净FBA费

  // ========== 仓储费部分 ==========
  monthlyStorageFee: number;     // 月度仓储费
  agedSurcharge: number;         // 超龄附加费
  totalStorageFee: number;       // ▶ 仓储费合计

  // ========== 其他费用 ==========
  liquidationFee: number;        // 清算手续费
  inventoryCompensation: number; // 库存赔偿
  safeTClaim: number;            // SAFE-T赔付
  refundOther: number;           // 退款-其他
  returnShippingFee: number;     // 退货运费
  disposalFee: number;           // 弃置费
  subscriptionFee: number;       // 订阅费(均摊)
  otherAdjustment: number;       // 其他调整（均摊）
  inboundFee: number;            // 入库配置费
  removalFee: number;            // 订单移除费

  // ========== 外部成本（从其他报表导入） ==========
  adFee: number;                 // 广告费
  headHaul: number;              // 头程
  productCost: number;           // 成本
  legangDelivery: number;        // 乐歌尾程
  jingdongDelivery: number;      // 京东尾程
  fakeOrderFee: number;          // 刷单费

  // ========== 汇总 ==========
  netIncome: number;             // ▶ SKU净收入
  profitMargin: number;
  manager: string;               // 负责人

  // 数据来源标注
  dataSources?: {
    storageFee: string;
    adFee: string;
    returnFee: string;
    productCost?: string;
    deliveryFee?: string;
  };
}

// 共享费用
export interface SharedFee {
  id?: number;
  month: string;
  storeName: string;
  category: string;
  totalAmount: number;
  description: string;
  source?: string;
}

// 全局收支核对
export interface Reconciliation {
  month: string;
  storeName: string;
  skuNetIncome: number;
  sharedFeeTotal: number;
  totalNetIncome: number;
  grandTotalFromBill: number;
  difference: number;
  settlementTotal?: number;
  settlementDiff?: number;
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

// ====== 多报表类型 ======

export interface SettlementReport {
  month: string;
  storeName: string;
  settlementId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  transactionCount: number;
  feeSummary: Record<string, number>;
  rawData: Record<string, string>[];
}

export interface StorageFeeItem {
  sku: string;
  asin: string;
  storageDate: string;
  volumeCubicFeet: number;
  rate: number;
  storageFee: number;
  month: string;
  storeName: string;
}

export interface AdReportItem {
  campaignName: string;
  campaignType: string;
  sku: string;
  asin: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  acos: number;
  month: string;
  storeName: string;
}

export interface ReturnReportItem {
  sku: string;
  asin: string;
  productName: string;
  returnQuantity: number;
  refundAmount: number;
  returnReason: string;
  returnDate: string;
  month: string;
  storeName: string;
}

export interface ProductCostItem {
  sku: string;
  productName: string;
  fobCost: number;
  currency: string;
  effectiveDate: string;
  month: string;
  storeName: string;
}

export interface DeliveryFeeItem {
  sku: string;
  orderId: string;
  deliveryFee: number;
  carrier: string;
  shippingMethod: string;
  destination: string;
  deliveryDate: string;
  month: string;
  storeName: string;
}

export interface UploadedReport {
  id: string;
  fileName: string;
  reportType: ReportType;
  month: string;
  storeName: string;
  uploadTime: string;
  rowCount: number;
  status: 'parsed' | 'merged';
}

export interface MultiReportResult {
  month: string;
  storeName: string;
  transactions: Transaction[];
  sharedFees: SharedFee[];
  reconciliation: Reconciliation | null;
  settlementReport?: SettlementReport;
  storageFeeItems?: StorageFeeItem[];
  adReportItems?: AdReportItem[];
  returnReportItems?: ReturnReportItem[];
  productCostItems?: ProductCostItem[];
  deliveryFeeItems?: DeliveryFeeItem[];
  uploadedReports: UploadedReport[];
}

export interface ParseResult {
  month: string;
  storeName: string;
  transactions: Transaction[];
  sharedFees: SharedFee[];
  reconciliation: Reconciliation | null;
}

export interface StoreConfig {
  id?: number;
  name: string;
  currency: string;
  subscriptionFee: number;
  otherSharedFees: number;
}

export const DEFAULT_STORES: StoreConfig[] = [
  { name: '一店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
  { name: '二店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
  { name: '三店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
];

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