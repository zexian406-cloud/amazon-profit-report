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

// 报表类型
export type ReportType =
  | 'transaction'    // 交易明细
  | 'settlement'     // 结算报告
  | 'storage'        // 仓储费报告
  | 'advertising'    // 广告报告
  | 'return';        // 退货报告

// 报表类型中文名
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  transaction: '交易明细',
  settlement: '结算报告',
  storage: '仓储费报告',
  advertising: '广告报告',
  return: '退货报告',
};

// 报表类型检测特征
export interface ReportTypeFeature {
  type: ReportType;
  keywords: string[];
  requiredColumns: string[][]; // 多组可选列，匹配任一即可
  priority: number; // 匹配优先级，越高越优先
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
  // 数据来源标注
  dataSources?: {
    storageFee: string;  // 'transaction' | 'storage_report' | 'merged'
    adFee: string;       // 'transaction' | 'ad_report' | 'merged'
    returnFee: string;   // 'transaction' | 'return_report' | 'merged'
  };
}

// 共享费用（无法归属到单个SKU的费用）
export interface SharedFee {
  id?: number;
  month: string;
  storeName: string;
  category: string;    // 如: 广告费, Vine注册费, 订阅费, 其他
  totalAmount: number;
  description: string;
  source?: string;     // 数据来源: 'transaction' | 'settlement' | 'ad_report' | 'storage_report'
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
  settlementTotal?: number;   // 结算报告总额（如有）
  settlementDiff?: number;    // 与结算报告的差异
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

// ====== 新增报表类型 ======

// 结算报告解析结果
export interface SettlementReport {
  month: string;
  storeName: string;
  settlementId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  transactionCount: number;
  feeSummary: Record<string, number>; // 费用分类汇总
  rawData: Record<string, string>[];
}

// 仓储费报告条目
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

// 广告报告条目
export interface AdReportItem {
  campaignName: string;
  campaignType: string; // SP / SB / SD
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

// 退货报告条目
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

// 已上传报表元信息
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

// 多报表解析结果
export interface MultiReportResult {
  month: string;
  storeName: string;
  transactions: Transaction[];
  sharedFees: SharedFee[];
  reconciliation: Reconciliation | null;
  // 各报表独立数据
  settlementReport?: SettlementReport;
  storageFeeItems?: StorageFeeItem[];
  adReportItems?: AdReportItem[];
  returnReportItems?: ReturnReportItem[];
  // 已上传报表清单
  uploadedReports: UploadedReport[];
}

// 解析结果（兼容旧版）
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