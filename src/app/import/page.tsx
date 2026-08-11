'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download,
  FileCheck, BarChart3, Undo2, Warehouse, File, Trash2, Layers, DollarSign, Truck, User,
  Sparkles, Table, ChevronRight, RefreshCw,
} from 'lucide-react';
import { parseExcel } from '@/lib/excel-parser';
import { calculateSKUProfitWithReports } from '@/lib/profit-calculator';
import { saveMonthlyData, saveSharedFees, saveProfitReport, saveManagerMappings } from '@/lib/idb';
import {
  ParseResult, SKUProfitRow, SharedFee, Reconciliation,
  ReportType, REPORT_TYPE_LABELS, UploadedReport,
  SettlementReport, StorageFeeItem, AdReportItem, ReturnReportItem,
  ProductCostItem, DeliveryFeeItem, ManagerMapping, getShopColor,
  PromotionFeeItem,
} from '@/lib/types';
import { useShops } from '@/hooks/use-shops';
import { ShopFilter } from '@/components/layout/shop-filter';
import {
  parseReportByType, detectReportType, extractSharedFeesFromReports,
  getReportTypeColor, getReportTypeIcon,
} from '@/lib/report-parser';
import {
  detectAllSheets, parseMultiSheetFile, SheetDetectionResult,
} from '@/lib/multi-sheet-parser';
import * as XLSX from 'xlsx';

const REPORT_TYPES: { type: ReportType; icon: typeof File }[] = [
  { type: 'transaction', icon: FileSpreadsheet },
  { type: 'settlement', icon: FileCheck },
  { type: 'storage', icon: Warehouse },
  { type: 'advertising', icon: BarChart3 },
  { type: 'return', icon: Undo2 },
  { type: 'productCost', icon: DollarSign },
  { type: 'deliveryFee', icon: Truck },
  { type: 'managerMapping', icon: User },
  { type: 'promotionFee', icon: Sparkles },
];

function ReportTypeIcon({ type, className }: { type: ReportType; className?: string }) {
  const iconMap: Record<ReportType, typeof File> = {
    transaction: FileSpreadsheet,
    settlement: FileCheck,
    storage: Warehouse,
    advertising: BarChart3,
    return: Undo2,
    productCost: DollarSign,
    deliveryFee: Truck,
    managerMapping: User,
    promotionFee: Sparkles,
  };
  const Icon = iconMap[type] || File;
  return <Icon className={className || 'h-4 w-4'} />;
}

export default function ImportPage() {
  const { shops } = useShops();
  // 报表类型选择
  const [reportType, setReportType] = useState<ReportType | 'auto'>('transaction');
  const [uploadStore, setUploadStore] = useState<string>('');

  // 已上传报表列表
  const [uploadedReports, setUploadedReports] = useState<UploadedReport[]>([]);

  // 交易明细数据
  const [transactionResult, setTransactionResult] = useState<ParseResult | null>(null);

  // 各报表独立数据
  const [settlementReport, setSettlementReport] = useState<SettlementReport | undefined>();
  const [storageFeeItems, setStorageFeeItems] = useState<StorageFeeItem[] | undefined>();
  const [adReportItems, setAdReportItems] = useState<AdReportItem[] | undefined>();
  const [returnReportItems, setReturnReportItems] = useState<ReturnReportItem[] | undefined>();
  const [productCostItems, setProductCostItems] = useState<ProductCostItem[] | undefined>();
  const [deliveryFeeItems, setDeliveryFeeItems] = useState<DeliveryFeeItem[] | undefined>();
  const [managerMappings, setManagerMappings] = useState<ManagerMapping[] | undefined>();

  // 解析状态
  const [parsing, setParsing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 多表格检测状态
  const [multiSheetResults, setMultiSheetResults] = useState<SheetDetectionResult[]>([]);
  const [multiSheetParsing, setMultiSheetParsing] = useState(false);
  const [multiSheetFile, setMultiSheetFile] = useState<File | null>(null);
  const [sheetTypeOverrides, setSheetTypeOverrides] = useState<Record<string, ReportType>>({});
  const [promotionFeeItems, setPromotionFeeItems] = useState<PromotionFeeItem[] | undefined>();

  // 计算结果
  const [skuRows, setSkuRows] = useState<SKUProfitRow[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [saved, setSaved] = useState(false);

  // 当前预览数据
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

  // 店铺列表加载后设置默认店铺
  useEffect(() => {
    if (shops.length > 0 && !uploadStore) {
      setUploadStore(shops[0].name!);
    }
  }, [shops, uploadStore]);

  // 激活的Tab
  const [activeTab, setActiveTab] = useState('upload');

  const currentReportType = reportType === 'auto' ? 'transaction' : reportType;

  // 处理文件上传
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [reportType, uploadedReports, transactionResult]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [reportType, uploadedReports, transactionResult]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setError('请上传 Excel 文件 (.xlsx, .xls, .csv)');
      return;
    }
    setError(null);
    setParsing(true);

    try {
      // 确定实际报表类型
      let actualType: ReportType = currentReportType;

      if (reportType === 'auto') {
        // 读取文件头部进行自动检测
        const reader = new FileReader();
        const headerStr = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const sheet = workbook.Sheets[workbook.SheetNames[0]];
              const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
              if (json.length > 0) {
                resolve(Object.keys(json[0]).join(' '));
              } else {
                resolve('');
              }
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('读取文件失败'));
          reader.readAsArrayBuffer(file.slice(0, 1024 * 64)); // 只读前64KB
        });
        actualType = detectReportType(headerStr.split(' '));
      }

      if (actualType === 'transaction') {
        // 交易明细-使用原有解析逻辑
        const result = await parseExcel(file);
        const store = uploadStore || result.storeName || '一店';
        result.storeName = store;
        result.transactions.forEach(t => { t.storeName = store; });
        setTransactionResult(result);
        setPreviewData(result.transactions.slice(0, 50).map(t => t.rawRow));
        setPreviewHeaders(Object.keys(result.transactions[0]?.rawRow || {}));

        // 添加到已上传列表
        const newReport: UploadedReport = {
          id: `txn-${Date.now()}`,
          fileName: file.name,
          reportType: 'transaction',
          month: result.month,
          storeName: store,
          uploadTime: new Date().toISOString(),
          rowCount: result.transactions.length,
          status: 'parsed',
        };
        setUploadedReports(prev => [...prev.filter(r => r.reportType !== 'transaction'), newReport]);
        setActiveTab('preview');
      } else if (actualType === 'managerMapping') {
        // 负责人映射 - 使用独立解析
        const { parseManagerMappingReport } = await import('@/lib/report-parser');
        const mappingResult = await parseManagerMappingReport(file);
        const store = uploadStore || '一店';
        const mappings = mappingResult.managerMappings.map(m => ({ sku: m.sku, productName: m.productName, manager: m.manager, storeName: m.storeName, updatedAt: new Date().toISOString() }));
        setManagerMappings(mappings);
        setPreviewData(mappingResult.managerMappings.map(m => ({
          SKU: m.sku,
          品名: m.productName,
          负责人: m.manager,
        })));
        setPreviewHeaders(['SKU', '品名', '负责人']);
        // 保存到 IndexedDB
        await saveManagerMappings(mappingResult.managerMappings.map(m => ({
          sku: m.sku,
          productName: m.productName,
          manager: m.manager,
          storeName: store,
          updatedAt: new Date().toISOString(),
        })));
        setUploadedReports(prev => [...prev, ...mappingResult.uploadedReports]);
        setActiveTab('reports');
      } else {
        // 其他报表类型
        const parsed = await parseReportByType(file, actualType);
        if (parsed.settlement) {
          setSettlementReport(parsed.settlement);
          setPreviewData(parsed.settlement.rawData.slice(0, 50));
          setPreviewHeaders(Object.keys(parsed.settlement.rawData[0] || {}));
        }
        if (parsed.storageFeeItems) {
          setStorageFeeItems(prev => [...(prev || []), ...parsed.storageFeeItems!]);
          setPreviewData(parsed.storageFeeItems.map(item => ({
            SKU: item.sku,
            ASIN: item.asin,
            仓储费: String(item.storageFee),
            体积: String(item.volumeCubicFeet),
            月份: item.month,
          })));
          setPreviewHeaders(['SKU', 'ASIN', '仓储费', '体积', '月份']);
        }
        if (parsed.adReportItems) {
          setAdReportItems(prev => [...(prev || []), ...parsed.adReportItems!]);
          setPreviewData(parsed.adReportItems.map(item => ({
            活动: item.campaignName,
            类型: item.campaignType,
            SKU: item.sku,
            花费: String(item.spend),
            销售额: String(item.sales),
            点击: String(item.clicks),
            曝光: String(item.impressions),
          })));
          setPreviewHeaders(['活动', '类型', 'SKU', '花费', '销售额', '点击', '曝光']);
        }
        if (parsed.returnReportItems) {
          setReturnReportItems(prev => [...(prev || []), ...parsed.returnReportItems!]);
          setPreviewData(parsed.returnReportItems.map(item => ({
            SKU: item.sku,
            ASIN: item.asin,
            退货数量: String(item.returnQuantity),
            退款金额: String(item.refundAmount),
            原因: item.returnReason,
          })));
          setPreviewHeaders(['SKU', 'ASIN', '退货数量', '退款金额', '原因']);
        }
        if (parsed.productCostItems) {
          setProductCostItems(prev => [...(prev || []), ...parsed.productCostItems!]);
          setPreviewData(parsed.productCostItems.map(item => ({
            SKU: item.sku,
            产品名: item.productName,
            FOB成本: String(item.fobCost),
            币种: item.currency,
            生效日期: item.effectiveDate,
          })));
          setPreviewHeaders(['SKU', '产品名', 'FOB成本', '币种', '生效日期']);
        }
        if (parsed.deliveryFeeItems) {
          setDeliveryFeeItems(prev => [...(prev || []), ...parsed.deliveryFeeItems!]);
          setPreviewData(parsed.deliveryFeeItems.map(item => ({
            SKU: item.sku,
            订单号: item.orderId,
            运费: String(item.deliveryFee),
            物流商: item.carrier,
            目的地: item.destination,
          })));
          setPreviewHeaders(['SKU', '订单号', '运费', '物流商', '目的地']);
        }

        setUploadedReports(prev => [...prev, ...parsed.uploadedReports]);
        setActiveTab('reports');
      }
    } catch (err) {
      setError(`解析失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setParsing(false);
    }
  }, [reportType, currentReportType, uploadStore]);

  // 移除已上传报表
  function removeReport(id: string) {
    const report = uploadedReports.find(r => r.id === id);
    if (!report) return;

    setUploadedReports(prev => prev.filter(r => r.id !== id));
    if (report.reportType === 'settlement') setSettlementReport(undefined);
    if (report.reportType === 'storage') {
      setStorageFeeItems(undefined);
    }
    if (report.reportType === 'advertising') setAdReportItems(undefined);
    if (report.reportType === 'return') setReturnReportItems(undefined);
    if (report.reportType === 'productCost') setProductCostItems(undefined);
    if (report.reportType === 'deliveryFee') setDeliveryFeeItems(undefined);
    if (report.reportType === 'managerMapping') setManagerMappings(undefined);
    if (report.reportType === 'promotionFee') setPromotionFeeItems(undefined);
  }

  // ====== 多表格一键上传 ======

  const handleMultiSheetFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('多表格上传请使用 .xlsx 或 .xls 格式');
      return;
    }
    setError(null);
    setMultiSheetParsing(true);
    setMultiSheetFile(file);
    setSheetTypeOverrides({});

    try {
      const results = await detectAllSheets(file);
      setMultiSheetResults(results);
    } catch (err) {
      setError(`多表格检测失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setMultiSheetParsing(false);
    }
  }, []);

  const handleMultiSheetDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleMultiSheetFile(files[0]);
    }
  }, [handleMultiSheetFile]);

  const handleMultiSheetSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleMultiSheetFile(files[0]);
    }
  }, [handleMultiSheetFile]);

  // 修改单个sheet的检测类型
  function changeSheetType(sheetName: string, newType: ReportType) {
    setSheetTypeOverrides(prev => ({ ...prev, [sheetName]: newType }));
  }

  // 确认多表格导入 - 自动计算利润并保存
  async function handleConfirmMultiSheet() {
    if (!multiSheetFile) return;
    setMultiSheetParsing(true);
    setError(null);

    try {
      const store = uploadStore || '一店';
      const result = await parseMultiSheetFile(multiSheetFile, store, sheetTypeOverrides);

      if (result.transactions.length === 0) {
        setError('未识别到交易明细数据，请检查文件内容');
        setMultiSheetParsing(false);
        return;
      }

      // 构建解析结果
      const orderTotal = result.transactions.filter(t => t.type === 'Order').reduce((s, t) => s + t.totalAmount, 0);
      const refundTotal = result.transactions.filter(t => t.type === 'Refund').reduce((s, t) => s + t.totalAmount, 0);
      const skuNetIncome = orderTotal + refundTotal;
      const sharedFeeTotal = result.sharedFees.reduce((s, f) => s + f.totalAmount, 0);

      const parseResult: ParseResult = {
        month: result.month,
        storeName: store,
        transactions: result.transactions,
        sharedFees: result.sharedFees,
        reconciliation: {
          month: result.month,
          storeName: store,
          skuNetIncome: Math.round(skuNetIncome * 100) / 100,
          sharedFeeTotal: Math.round(sharedFeeTotal * 100) / 100,
          totalNetIncome: Math.round((skuNetIncome + sharedFeeTotal) * 100) / 100,
          grandTotalFromBill: Math.round(skuNetIncome * 100) / 100,
          difference: 0,
        },
      };

      // 设置状态
      setTransactionResult(parseResult);
      setPreviewData(result.transactions.slice(0, 50).map(t => t.rawRow));
      setPreviewHeaders(Object.keys(result.transactions[0]?.rawRow || {}));
      if (result.storageFeeItems.length > 0) setStorageFeeItems(result.storageFeeItems);
      if (result.promotionFeeItems.length > 0) setPromotionFeeItems(result.promotionFeeItems);
      setUploadedReports(result.uploadedReports);
      setMultiSheetResults([]);
      setMultiSheetFile(null);

      // 自动计算利润
      const extraFees = extractSharedFeesFromReports(
        settlementReport,
        adReportItems,
        result.storageFeeItems.length > 0 ? result.storageFeeItems : storageFeeItems,
        result.month,
        store,
      );
      const allSharedFees = [...result.sharedFees, ...extraFees];
      const currentShop = shops.find(s => s.name === store);
      const defaultManager = currentShop?.defaultManager || '';
      const { skuRows: rows, reconciliation: recon } = calculateSKUProfitWithReports(
        result.transactions,
        allSharedFees,
        result.month,
        store,
        result.storageFeeItems.length > 0 ? result.storageFeeItems : storageFeeItems,
        adReportItems,
        returnReportItems,
        settlementReport,
        productCostItems,
        deliveryFeeItems,
        defaultManager,
        managerMappings,
        result.promotionFeeItems.length > 0 ? result.promotionFeeItems : promotionFeeItems,
      );
      setSkuRows(rows);
      setReconciliation(recon);
      setUploadedReports(result.uploadedReports.map(r => ({ ...r, status: 'merged' as const })));

      // 自动保存到 IndexedDB
      const monthlyData = {
        month: result.month,
        storeName: store,
        importDate: new Date().toISOString(),
        fileName: multiSheetFile.name,
        transactions: result.transactions,
      };
      await saveMonthlyData(monthlyData);
      await saveSharedFees(allSharedFees);
      await saveProfitReport(rows);
      setSaved(true);

      // 跳转到利润表页面
      setActiveTab('profit');
    } catch (err) {
      setError(`多表格导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setMultiSheetParsing(false);
    }
  }

  // 合并所有报表数据并计算利润
  async function handleCalculate() {
    if (!transactionResult) {
      setError('请先上传交易明细报表');
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      // 从各报表提取共享费用
      const extraFees = extractSharedFeesFromReports(
        settlementReport,
        adReportItems,
        storageFeeItems,
        transactionResult.month,
        transactionResult.storeName
      );

      // 合并共享费用
      const allSharedFees = [...transactionResult.sharedFees, ...extraFees];

      // 合并广告费中的SKU级别数据
      const currentShop = shops.find(s => s.name === transactionResult.storeName);
      const defaultManager = currentShop?.defaultManager || '';
      const { skuRows: rows, reconciliation: recon } = calculateSKUProfitWithReports(
        transactionResult.transactions,
        allSharedFees,
        transactionResult.month,
        transactionResult.storeName,
        storageFeeItems,
        adReportItems,
        returnReportItems,
        settlementReport,
        productCostItems,
        deliveryFeeItems,
        defaultManager,
        managerMappings,
        promotionFeeItems,
      );

      setSkuRows(rows);
      setReconciliation(recon);

      // 标记已上传报表为已合并
      setUploadedReports(prev => prev.map(r => ({ ...r, status: 'merged' as const })));

      setActiveTab('profit');
    } catch (err) {
      setError(`计算失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCalculating(false);
    }
  }

  // 保存数据
  async function handleSave() {
    if (!transactionResult || skuRows.length === 0) return;
    try {
      const monthlyData = {
        month: transactionResult.month,
        storeName: transactionResult.storeName,
        importDate: new Date().toISOString(),
        fileName: uploadedReports.map(r => r.fileName).join('; ') || '未知',
        transactions: transactionResult.transactions,
      };
      await saveMonthlyData(monthlyData);
      await saveSharedFees(transactionResult.sharedFees);
      await saveProfitReport(skuRows);
      setSaved(true);
      setActiveTab('reconciliation');
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  // 导出Excel - 41列模板
  function handleExport() {
    if (!transactionResult || skuRows.length === 0) return;
    const wb = XLSX.utils.book_new();

    // Sheet1: SKU利润表（41列模板）
    const ws1Data: (string | number)[][] = [
      [`${transactionResult.storeName} ${transactionResult.month} SKU利润表`],
      [],
      ['SKU', '订单量', '退款量',
        '商品销售收入', '运费收入', '清算残值收入',
        '退款-商品', '退款-运费', '退款-促销回冲', '促销折扣',
        '▶ 净销售额',
        '销售佣金', '退款-佣金退回', 'Coupon费', '▶ 净佣金',
        'FBA配送费', '退款-FBA费退回', '退货处理费', '入库异常费', '▶ 净FBA费',
        '月度仓储费', '超龄附加费', '▶ 仓储费合计',
        '清算手续费', '库存赔偿', 'SAFE-T赔付', '退款-其他', '退货运费',
        '弃置费', '订阅费(均摊)', '其他调整（均摊）', '入库配置费', '订单移除费',
        '广告费', '头程', '成本', ...(skuRows[0]?.deliveryFeeByProvider ? Object.keys(skuRows[0].deliveryFeeByProvider) : ['尾程运费']), '刷单费',
        '▶ SKU净收入', '利润率(%)', '负责人'],
    ];
    for (const row of skuRows) {
      ws1Data.push([
        row.sku,
        row.orderQuantity, row.refundQuantity,
        row.productSales, row.shippingIncome, row.liquidationValue,
        row.refundProduct, row.refundShipping, row.refundPromo, row.promoDiscount,
        row.netSales,
        row.salesCommission, row.refundCommission, row.couponFee, row.netCommission,
        row.fbaDeliveryFee, row.refundFBAFee, row.returnFee, row.inboundAbnormalFee, row.netFBAFee,
        row.monthlyStorageFee, row.agedSurcharge, row.totalStorageFee,
        row.liquidationFee, row.inventoryCompensation, row.safeTClaim,
        row.refundOther, row.returnShippingFee, row.disposalFee,
        row.subscriptionFee, row.otherAdjustment, row.inboundFee, row.removalFee,
        row.adFee, row.headHaul, row.productCost, ...(row.deliveryFeeByProvider ? Object.keys(row.deliveryFeeByProvider).map(k => row.deliveryFeeByProvider[k]) : []), row.fakeOrderFee,
        row.netIncome, (row.profitMargin * 100).toFixed(2), row.manager,
      ]);
    }
    // 合计行
    const sum = (fn: (r: typeof skuRows[0]) => number) => Math.round(skuRows.reduce((s, r) => s + fn(r), 0) * 100) / 100;
    ws1Data.push([]);
    ws1Data.push(['合计',
      sum(r => r.orderQuantity), sum(r => r.refundQuantity),
      sum(r => r.productSales), sum(r => r.shippingIncome), sum(r => r.liquidationValue),
      sum(r => r.refundProduct), sum(r => r.refundShipping), sum(r => r.refundPromo), sum(r => r.promoDiscount),
      sum(r => r.netSales),
      sum(r => r.salesCommission), sum(r => r.refundCommission), sum(r => r.couponFee), sum(r => r.netCommission),
      sum(r => r.fbaDeliveryFee), sum(r => r.refundFBAFee), sum(r => r.returnFee), sum(r => r.inboundAbnormalFee), sum(r => r.netFBAFee),
      sum(r => r.monthlyStorageFee), sum(r => r.agedSurcharge), sum(r => r.totalStorageFee),
      sum(r => r.liquidationFee), sum(r => r.inventoryCompensation), sum(r => r.safeTClaim),
      sum(r => r.refundOther), sum(r => r.returnShippingFee), sum(r => r.disposalFee),
      sum(r => r.subscriptionFee), sum(r => r.otherAdjustment), sum(r => r.inboundFee), sum(r => r.removalFee),
      sum(r => r.adFee), sum(r => r.headHaul), sum(r => r.productCost), ...(skuRows[0]?.deliveryFeeByProvider ? Object.keys(skuRows[0].deliveryFeeByProvider).map(p => sum(r => r.deliveryFeeByProvider[p] || 0)) : []), sum(r => r.fakeOrderFee),
      sum(r => r.netIncome), '', '']);
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = ws1Data[2].map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'SKU利润表');

    // Sheet2: 共享费用
    const ws2Data: (string | number)[][] = [
      [`${transactionResult.storeName} ${transactionResult.month} 共享费用`],
      [],
      ['费用类别', '金额', '描述', '数据来源'],
    ];
    for (const fee of transactionResult.sharedFees) {
      ws2Data.push([fee.category, fee.totalAmount, fee.description, fee.source || 'transaction']);
    }
    ws2Data.push([]);
    ws2Data.push(['合计', transactionResult.sharedFees.reduce((s, f) => s + f.totalAmount, 0), '', '']);
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 40 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, '共享费用');

    // Sheet3: 全局收支核对
    if (reconciliation) {
      const ws3Data: (string | number)[][] = [
        [`${transactionResult.storeName} ${transactionResult.month} 全局收支核对`],
        [],
        ['项目', '金额'],
        ['SKU净收入汇总', reconciliation.skuNetIncome],
        ['共享费用汇总', reconciliation.sharedFeeTotal],
        ['净收入', reconciliation.totalNetIncome],
        ['原始账单总计', reconciliation.grandTotalFromBill],
        ['差异', reconciliation.difference],
      ];
      if (reconciliation.settlementTotal !== undefined) {
        ws3Data.push(['结算报告总额', reconciliation.settlementTotal]);
        ws3Data.push(['与结算报告差异', reconciliation.settlementDiff ?? 0]);
      }
      const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
      ws3['!cols'] = [{ wch: 24 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws3, '全局收支核对');
    }

    // Sheet4: 报表清单
    const ws4Data: (string | number | Date)[][] = [
      ['已上传报表清单'],
      [],
      ['报表类型', '文件名', '月份', '上传时间', '行数'],
    ];
    for (const r of uploadedReports) {
      ws4Data.push([REPORT_TYPE_LABELS[r.reportType], r.fileName, r.month, r.uploadTime, r.rowCount]);
    }
    const ws4 = XLSX.utils.aoa_to_sheet(ws4Data);
    ws4['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws4, '报表清单');

    XLSX.writeFile(wb, `${transactionResult.storeName}_${transactionResult.month}_利润报表_多报表.xlsx`);
  }

  // 合并后的共享费用（用于预览）
  const mergedSharedFees = transactionResult
    ? [
        ...transactionResult.sharedFees,
        ...extractSharedFeesFromReports(
          settlementReport, adReportItems, storageFeeItems,
          transactionResult.month, transactionResult.storeName
        ),
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据导入</h1>
        <p className="text-sm text-[#6E6E73] mt-1">
          上传多种亚马逊报表，系统自动合并分析，生成完整利润报表
        </p>
      </div>

      {/* 店铺数据概览 */}
      <Card className="border-0 rounded-2xl apple-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-primary" />
            店铺数据概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {shops.map((shop) => {
              const storeReports = uploadedReports.filter(r => r.storeName === shop.name);
              const storeMonths = new Set(storeReports.map(r => r.month));
              return (
                <div key={shop.id} className="p-3 rounded-lg border border-[#E5E5EA]/50 bg-card text-center hover:shadow-sm transition-shadow">
                  <p className="text-sm font-medium" style={{ color: getShopColor(shop.name!) }}>
                    {shop.name}
                  </p>
                  <p className="text-2xl font-bold mt-1">{storeReports.length}</p>
                  <p className="text-xs text-[#6E6E73]">报表 · {storeMonths.size}个月</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 多表格一键导入 */}
      <Card className="border-0 rounded-2xl apple-card border-primary/20" style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 50%)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            多表格一键导入
            <Badge variant="default" className="text-xs bg-primary/10 text-primary border-0">推荐</Badge>
          </CardTitle>
          <CardDescription>
            上传包含多个Sheet的Excel文件，系统自动识别每个表格类型并一起处理
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#6E6E73]">选择店铺：</span>
            <ShopFilter
              value={uploadStore}
              onChange={setUploadStore}
              mode="select"
            />
          </div>

          {!multiSheetResults.length && !multiSheetParsing && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-white/50"
              onDrop={handleMultiSheetDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('multi-sheet-upload')?.click()}
            >
              <input
                id="multi-sheet-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleMultiSheetSelect}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Table className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-medium">拖拽Excel文件到此处，或点击上传</p>
                <p className="text-xs text-[#6E6E73]">
                  支持 .xlsx .xls 格式，可包含多个Sheet（交易明细、仓储费、促销费用等）
                </p>
              </div>
            </div>
          )}

          {multiSheetParsing && (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-[#6E6E73]">正在检测表格类型...</p>
            </div>
          )}

          {multiSheetResults.length > 0 && !multiSheetParsing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    检测到 {multiSheetResults.length} 个表格
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    setMultiSheetResults([]);
                    setMultiSheetFile(null);
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  重新上传
                </Button>
              </div>

              <div className="space-y-2">
                {multiSheetResults.map((sheet) => {
                  const effectiveType = sheetTypeOverrides[sheet.sheetName] || sheet.detectedType;
                  const confidencePercent = Math.round(sheet.confidence * 100);
                  return (
                    <div
                      key={sheet.sheetName}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E5EA]/50 bg-white hover:shadow-sm transition-shadow"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${getReportTypeColor(effectiveType)}15` }}
                      >
                        <ReportTypeIcon
                          type={effectiveType}
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{sheet.sheetName}</span>
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0"
                            style={{ color: getReportTypeColor(effectiveType), borderColor: `${getReportTypeColor(effectiveType)}40` }}
                          >
                            {REPORT_TYPE_LABELS[effectiveType]}
                          </Badge>
                          {sheet.confidence >= 0.8 ? (
                            <Badge variant="outline" className="text-xs bg-[#34C759]/10 text-[#34C759] border-0">
                              高置信度 {confidencePercent}%
                            </Badge>
                          ) : sheet.confidence >= 0.5 ? (
                            <Badge variant="outline" className="text-xs bg-[#FF9500]/10 text-[#FF9500] border-0">
                              中置信度 {confidencePercent}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-[#8E8E93]/10 text-[#8E8E93] border-0">
                              低置信度 {confidencePercent}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#6E6E73] mt-0.5">
                          {sheet.rowCount} 行 · 列: {sheet.headers.slice(0, 5).join(', ')}
                          {sheet.headers.length > 5 && ` ... +${sheet.headers.length - 5}`}
                        </p>
                      </div>
                      {/* 类型切换 */}
                      <select
                        className="text-xs border border-[#E5E5EA]/50 rounded-md px-2 py-1 bg-white shrink-0 max-w-[120px]"
                        value={effectiveType}
                        onChange={(e) => changeSheetType(sheet.sheetName, e.target.value as ReportType)}
                      >
                        {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 p-4 bg-[#F5F5F7] border border-[#E5E5EA]/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">确认导入所有表格</p>
                  <p className="text-xs text-[#6E6E73]">
                    系统将自动解析所有表格并合并数据，如检测类型有误可手动修改
                  </p>
                </div>
                <Button
                  onClick={handleConfirmMultiSheet}
                  size="default"
                  className="rounded-lg gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  确认导入
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 报表类型选择器 */}
      <Card className="border-0 rounded-2xl apple-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            选择报表类型
          </CardTitle>
          <CardDescription>
            选择要上传的报表类型，或选择「自动识别」让系统判断
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={reportType === 'auto' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('auto')}
              className="gap-1.5 rounded-lg"
            >
              <Layers className="h-3.5 w-3.5" />
              自动识别
            </Button>
            {REPORT_TYPES.map(({ type, icon: Icon }) => (
              <Button
                key={type}
                variant={reportType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReportType(type)}
                className="gap-1.5 rounded-lg"
              >
                <Icon className="h-3.5 w-3.5" />
                {REPORT_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 上传区域 */}
      <Card className="border-0 rounded-2xl apple-card">
        <CardHeader>
          <CardTitle className="text-base">
            {reportType === 'auto' ? '上传文件（自动识别类型）' : `上传${REPORT_TYPE_LABELS[currentReportType]}`}
          </CardTitle>
          <CardDescription>
            支持亚马逊后台导出的各类报表 (.xlsx, .xls, .csv)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#6E6E73]">选择店铺：</span>
            <ShopFilter
              value={uploadStore}
              onChange={setUploadStore}
              mode="select"
            />
          </div>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-[#F5F5F7]/30"
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-[#6E6E73]">正在解析文件...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-[#6E6E73]" />
                <p className="text-sm font-medium">拖拽文件到此处，或点击上传</p>
                <p className="text-xs text-[#6E6E73]">
                  支持 .xlsx .xls .csv 格式
                </p>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-3 text-sm text-[#FF3B30]">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已上传报表列表 */}
      {uploadedReports.length > 0 && (
        <Card className="border-0 rounded-2xl apple-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              已上传报表 ({uploadedReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadedReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#E5E5EA]/50 bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F5F5F7]"
                    >
                      <ReportTypeIcon
                        type={report.reportType}
                        className="h-4 w-4 text-[#6E6E73]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{report.fileName}</span>
                        <Badge variant="outline" className="text-xs border-[#E5E5EA]/50">
                          {REPORT_TYPE_LABELS[report.reportType]}
                        </Badge>
                        <Badge
                          variant={report.status === 'merged' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {report.status === 'merged' ? '已合并' : '已解析'}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-[#E5E5EA]/50 text-[#6E6E73]">
                          {report.storeName || '一店'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#6E6E73] mt-0.5">
                        {report.month} · {report.storeName} · {report.rowCount} 行
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#6E6E73] hover:text-[#FF3B30]"
                    onClick={() => removeReport(report.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 预览 & 结果 */}
      {(transactionResult || storageFeeItems || adReportItems || returnReportItems || settlementReport || promotionFeeItems) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap bg-[#F5F5F7] p-1 rounded-lg">
            <TabsTrigger value="preview" disabled={!transactionResult} className="rounded-md">
              交易明细预览
            </TabsTrigger>
            <TabsTrigger value="reports" disabled={uploadedReports.length === 0} className="rounded-md">
              多报表数据
            </TabsTrigger>
            <TabsTrigger value="profit" disabled={skuRows.length === 0} className="rounded-md">
              利润表
            </TabsTrigger>
            <TabsTrigger value="reconciliation" disabled={!reconciliation} className="rounded-md">
              收支核对
            </TabsTrigger>
          </TabsList>

          {/* 交易明细预览 */}
          <TabsContent value="preview" className="space-y-4">
            {transactionResult && (
              <>
                <Card className="border-0 rounded-2xl apple-card">
                  <CardHeader>
                    <CardTitle className="text-base">交易明细解析结果</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-3 rounded-lg bg-[#F5F5F7]">
                        <p className="text-xs text-[#6E6E73]">月份</p>
                        <p className="text-lg font-semibold">{transactionResult.month}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F5F5F7]">
                        <p className="text-xs text-[#6E6E73]">店铺</p>
                        <p className="text-lg font-semibold">{transactionResult.storeName}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F5F5F7]">
                        <p className="text-xs text-[#6E6E73]">交易记录</p>
                        <p className="text-lg font-semibold">{transactionResult.transactions.length}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F5F5F7]">
                        <p className="text-xs text-[#6E6E73]">共享费用</p>
                        <p className="text-lg font-semibold">{mergedSharedFees.length}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F5F5F7]">
                        <p className="text-xs text-[#6E6E73]">其他报表</p>
                        <p className="text-lg font-semibold">{uploadedReports.length - 1}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 确认导入按钮 */}
                <div className="flex items-center gap-3 p-4 bg-[#F5F5F7] border border-[#E5E5EA]/50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">确认导入数据</p>
                    <p className="text-xs text-[#6E6E73]">
                      确认后系统将自动计算利润表，并进入利润表页面。你还可以在「多报表数据」标签页上传其他补充报表后再合并计算。
                    </p>
                  </div>
                  <Button
                    onClick={handleCalculate}
                    disabled={calculating}
                    size="default"
                    className="rounded-lg"
                  >
                    {calculating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 计算中...</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> 确认导入</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    className="rounded-lg"
                    onClick={() => setActiveTab('reports')}
                  >
                    先上传其他报表
                  </Button>
                </div>

                <Card className="border-0 rounded-2xl apple-card">
                  <CardHeader>
                    <CardTitle className="text-base">交易分类明细</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E5EA]/50">
                            <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">类型</th>
                            <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU</th>
                            <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">数量</th>
                            <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">金额</th>
                            <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">描述</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactionResult.transactions.slice(0, 100).map((t, i) => (
                            <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                              <td className="py-2 px-2">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                                  t.type === 'Order' ? 'bg-[#34C759]/10 text-[#34C759]' :
                                  t.type === 'Refund' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
                                  'bg-[#F5F5F7] text-[#6E6E73]'
                                }`}>
                                  {t.type}
                                </span>
                              </td>
                              <td className="py-2 px-2 max-w-[120px] truncate">{t.sku}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{t.quantity}</td>
                              <td className="py-2 px-2 text-right tabular-nums">${t.totalAmount.toFixed(2)}</td>
                              <td className="py-2 px-2 max-w-[200px] truncate text-[#6E6E73]">{t.description}</td>
                            </tr>
                          ))}
                          {transactionResult.transactions.length > 100 && (
                            <tr>
                              <td colSpan={5} className="text-center py-2 text-[#6E6E73] text-xs">
                                仅显示前100条，共 {transactionResult.transactions.length} 条
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* 多报表数据 */}
          <TabsContent value="reports" className="space-y-4">
            {settlementReport && (
              <Card className="border-0 rounded-2xl apple-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-purple-500" />
                    结算报告
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">结算ID</p>
                      <p className="text-sm font-medium">{settlementReport.settlementId}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">结算总额</p>
                      <p className="text-lg font-semibold">${settlementReport.totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">交易笔数</p>
                      <p className="text-sm font-medium">{settlementReport.transactionCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">结算周期</p>
                      <p className="text-sm font-medium">{settlementReport.periodStart} ~ {settlementReport.periodEnd}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">费用分类汇总</p>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                            <th className="text-left py-1 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">费用类型</th>
                            <th className="text-right py-1 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">金额</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(settlementReport.feeSummary).map(([type, amount], i) => (
                            <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                              <td className="py-1 px-2">{type}</td>
                              <td className={`py-1 px-2 text-right tabular-nums ${amount < 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>
                                ${amount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {storageFeeItems && storageFeeItems.length > 0 && (
              <Card className="border-0 rounded-2xl apple-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-[#FF9500]" />
                    仓储费报告 ({storageFeeItems.length} 条)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">仓储体积</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">费率</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">仓储费</th>
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">月份</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storageFeeItems.map((item, i) => (
                          <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                            <td className="py-2 px-2 max-w-[120px] truncate">{item.sku}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{item.volumeCubicFeet.toFixed(4)}</td>
                            <td className="py-2 px-2 text-right tabular-nums">${item.rate.toFixed(4)}</td>
                            <td className="py-2 px-2 text-right font-medium tabular-nums">${item.storageFee.toFixed(2)}</td>
                            <td className="py-2 px-2">{item.month}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {adReportItems && adReportItems.length > 0 && (
              <Card className="border-0 rounded-2xl apple-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#FF3B30]" />
                    广告报告 ({adReportItems.length} 条)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">总花费</p>
                      <p className="text-lg font-semibold text-[#FF3B30]">
                        ${adReportItems.reduce((s, i) => s + i.spend, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">总销售额</p>
                      <p className="text-lg font-semibold text-[#34C759]">
                        ${adReportItems.reduce((s, i) => s + i.sales, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">总点击</p>
                      <p className="text-lg font-semibold tabular-nums">{adReportItems.reduce((s, i) => s + i.clicks, 0)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">总曝光</p>
                      <p className="text-lg font-semibold tabular-nums">{adReportItems.reduce((s, i) => s + i.impressions, 0)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">活动</th>
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">类型</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">花费</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">销售额</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">ACoS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adReportItems.slice(0, 50).map((item, i) => (
                          <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                            <td className="py-2 px-2 max-w-[150px] truncate">{item.campaignName}</td>
                            <td className="py-2 px-2">
                              <Badge variant="outline" className="text-xs border-[#E5E5EA]/50">{item.campaignType}</Badge>
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">${item.spend.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right tabular-nums">${item.sales.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{(item.acos * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {returnReportItems && returnReportItems.length > 0 && (
              <Card className="border-0 rounded-2xl apple-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Undo2 className="h-4 w-4 text-[#34C759]" />
                    退货报告 ({returnReportItems.length} 条)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">退货数量</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">退款金额</th>
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnReportItems.map((item, i) => (
                          <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                            <td className="py-2 px-2 max-w-[120px] truncate">{item.sku}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{item.returnQuantity}</td>
                            <td className="py-2 px-2 text-right tabular-nums">${item.refundAmount.toFixed(2)}</td>
                            <td className="py-2 px-2 max-w-[200px] truncate text-[#6E6E73]">{item.returnReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {promotionFeeItems && promotionFeeItems.length > 0 && (
              <Card className="border-0 rounded-2xl apple-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    促销费用分摊 ({promotionFeeItems.length} 条)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">总促销费用</p>
                      <p className="text-lg font-semibold text-[#FF3B30]">
                        ${promotionFeeItems.reduce((s, i) => s + Math.abs(i.totalFee), 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">总销售额</p>
                      <p className="text-lg font-semibold text-[#34C759]">
                        ${promotionFeeItems.reduce((s, i) => s + i.salesAmount, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">涉及SKU数</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {new Set(promotionFeeItems.map(i => i.sku)).size}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU</th>
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">促销编码</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">销售额</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">促销费用</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotionFeeItems.map((item, i) => (
                          <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                            <td className="py-2 px-2 max-w-[120px] truncate">{item.sku}</td>
                            <td className="py-2 px-2 max-w-[200px] truncate text-[#6E6E73] text-xs">{item.promotionCode}</td>
                            <td className="py-2 px-2 text-right tabular-nums">${item.salesAmount.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-[#FF3B30]">${Math.abs(item.totalFee).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {productCostItems && productCostItems.length > 0 && (
              <Card className="border-0 rounded-2xl apple-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-sky-500" />
                    产品成本数据 ({productCostItems.length} 条)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU</th>
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">产品名称</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">FOB/采购价</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productCostItems.map((item, i) => (
                          <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                            <td className="py-2 px-2 max-w-[120px] truncate">{item.sku}</td>
                            <td className="py-2 px-2 max-w-[200px] truncate text-[#6E6E73]">{item.productName}</td>
                            <td className="py-2 px-2 text-right font-medium tabular-nums">${item.fobCost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {deliveryFeeItems && deliveryFeeItems.length > 0 && (
              <Card className="border-0 rounded-2xl apple-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4 text-indigo-500" />
                    尾程运费数据 ({deliveryFeeItems.length} 条)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">总运费</p>
                      <p className="text-lg font-semibold tabular-nums">${deliveryFeeItems.reduce((s, i) => s + i.deliveryFee, 0).toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">最大单笔</p>
                      <p className="text-lg font-semibold tabular-nums">${Math.max(...deliveryFeeItems.map(i => i.deliveryFee)).toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F5F5F7]">
                      <p className="text-xs text-[#6E6E73]">涉及SKU数</p>
                      <p className="text-lg font-semibold tabular-nums">{new Set(deliveryFeeItems.map(i => i.sku)).size}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU</th>
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">订单号</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">运费</th>
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">承运商</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryFeeItems.map((item, i) => (
                          <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                            <td className="py-2 px-2 max-w-[120px] truncate">{item.sku}</td>
                            <td className="py-2 px-2 max-w-[140px] truncate text-[#6E6E73]">{item.orderId}</td>
                            <td className="py-2 px-2 text-right font-medium tabular-nums">${item.deliveryFee.toFixed(2)}</td>
                            <td className="py-2 px-2 max-w-[100px] truncate">{item.carrier || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 计算按钮 */}
            <div className="flex gap-2 items-center">
              <Button
                onClick={handleCalculate}
                disabled={calculating || !transactionResult}
                size="lg"
                className="rounded-lg"
              >
                {calculating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 合并计算中...</>
                ) : (
                  <><Layers className="mr-2 h-4 w-4" /> 合并所有报表数据并生成利润表</>
                )}
              </Button>
              {uploadedReports.length > 1 && (
                <p className="text-xs text-[#6E6E73] ml-2">
                  已上传 {uploadedReports.length} 种报表，将自动合并数据
                </p>
              )}
            </div>
          </TabsContent>

          {/* 利润表 */}
          <TabsContent value="profit" className="space-y-4">
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">SKU利润表</CardTitle>
                  {uploadedReports.length > 1 && (
                    <p className="text-xs text-[#6E6E73] mt-1">
                      数据来源：{uploadedReports.map(r => REPORT_TYPE_LABELS[r.reportType]).join(' + ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={skuRows.length === 0} className="rounded-lg">
                    <Download className="mr-2 h-4 w-4" />
                    导出Excel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saved} className="rounded-lg">
                    {saved ? '已保存' : '保存到本地'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {skuRows.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#6E6E73] mb-2">尚未计算利润表</p>
                    <p className="text-sm text-[#6E6E73]">
                      请先在「交易明细预览」标签页点击 <strong>确认导入</strong> 按钮，或切换到「多报表数据」标签页上传补充报表后再合并计算
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                          <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">订单量</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">退款量</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">净销售额</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">净佣金</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">净FBA费</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">
                            仓储费
                            <span className="ml-1 text-[10px]">(来源)</span>
                          </th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">
                            广告费
                            <span className="ml-1 text-[10px]">(来源)</span>
                          </th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">入库配置费</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">退货处理费</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">订阅费</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">其他调整</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">SKU净收入</th>
                          <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">利润率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skuRows.map((row, i) => (
                          <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                            <td className="py-2 px-2 font-medium max-w-[100px] truncate text-xs">{row.sku}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">{row.orderQuantity}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">{row.refundQuantity}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">${row.netSales.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">${row.netCommission.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">${row.netFBAFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-xs">
                              <span className="font-medium tabular-nums">${row.monthlyStorageFee.toFixed(2)}</span>
                              <span className={`ml-1 text-[10px] ${
                                row.dataSources?.storageFee === 'storage_report' ? 'text-[#FF9500]' :
                                row.dataSources?.storageFee === 'merged' ? 'text-primary' : 'text-[#6E6E73]'
                              }`}>
                                {row.dataSources?.storageFee === 'storage_report' ? '📋' :
                                 row.dataSources?.storageFee === 'merged' ? '🔄' : ''}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right text-xs">
                              <span className="font-medium tabular-nums">${row.adFee.toFixed(2)}</span>
                              <span className={`ml-1 text-[10px] ${
                                row.dataSources?.adFee === 'ad_report' ? 'text-[#FF3B30]' :
                                row.dataSources?.adFee === 'merged' ? 'text-primary' : 'text-[#6E6E73]'
                              }`}>
                                {row.dataSources?.adFee === 'ad_report' ? '📋' :
                                 row.dataSources?.adFee === 'merged' ? '🔄' : ''}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">${row.inboundFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">${row.returnFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">${row.subscriptionFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-xs tabular-nums">${row.otherAdjustment.toFixed(2)}</td>
                            <td className={`py-2 px-2 text-right font-semibold text-xs tabular-nums ${row.netIncome >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                              ${row.netIncome.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
                                row.profitMargin >= 0.2 ? 'bg-[#34C759]/10 text-[#34C759]' :
                                row.profitMargin >= 0 ? 'bg-[#FF9500]/10 text-[#FF9500]' :
                                'bg-[#FF3B30]/10 text-[#FF3B30]'
                              }`}>
                                {(row.profitMargin * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {skuRows.length > 0 && (
                  <div className="mt-3 text-xs text-[#6E6E73] flex items-center gap-4">
                    <span>📋 来自报表数据</span>
                    <span>🔄 多源合并数据</span>
                    <span>无标记 = 来自交易明细</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 收支核对 */}
          <TabsContent value="reconciliation" className="space-y-4">
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader>
                <CardTitle className="text-base">全局收支核对</CardTitle>
              </CardHeader>
              <CardContent>
                {reconciliation ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-[#F5F5F7] rounded-lg p-4">
                        <p className="text-xs text-[#6E6E73] font-medium">SKU净收入汇总</p>
                        <p className="text-2xl font-bold tabular-nums">${reconciliation.skuNetIncome.toFixed(2)}</p>
                      </div>
                      <div className="bg-[#F5F5F7] rounded-lg p-4">
                        <p className="text-xs text-[#6E6E73] font-medium">共享费用汇总</p>
                        <p className="text-2xl font-bold tabular-nums">${reconciliation.sharedFeeTotal.toFixed(2)}</p>
                      </div>
                      <div className="bg-[#F5F5F7] rounded-lg p-4">
                        <p className="text-xs text-[#6E6E73] font-medium">净收入</p>
                        <p className="text-2xl font-bold tabular-nums">${reconciliation.totalNetIncome.toFixed(2)}</p>
                      </div>
                      <div className={`rounded-lg p-4 ${Math.abs(reconciliation.difference) < 0.01 ? 'bg-[#34C759]/10' : 'bg-[#FF3B30]/10'}`}>
                        <p className="text-xs font-medium text-[#6E6E73]">账单差异</p>
                        <p className={`text-2xl font-bold tabular-nums ${Math.abs(reconciliation.difference) < 0.01 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                          ${reconciliation.difference.toFixed(2)}
                        </p>
                        <p className="text-xs mt-1">
                          {Math.abs(reconciliation.difference) < 0.01 ? '✓ 账目平衡' : '⚠ 存在差异'}
                        </p>
                      </div>
                    </div>

                    {/* 结算报告交叉验证 */}
                    {reconciliation.settlementTotal !== undefined && (
                      <div className="border border-[#E5E5EA]/50 rounded-lg p-4 bg-[#F5F5F7]/30">
                        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-purple-500" />
                          结算报告交叉验证
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-[#6E6E73]">结算报告总额</p>
                            <p className="text-lg font-semibold tabular-nums">${reconciliation.settlementTotal.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#6E6E73]">本次计算净收入</p>
                            <p className="text-lg font-semibold tabular-nums">${reconciliation.totalNetIncome.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#6E6E73]">差异</p>
                            <p className={`text-lg font-semibold tabular-nums ${
                              reconciliation.settlementDiff !== undefined && Math.abs(reconciliation.settlementDiff) < 0.01
                                ? 'text-[#34C759]' : 'text-[#FF9500]'
                            }`}>
                              ${reconciliation.settlementDiff?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border border-[#E5E5EA]/50 rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-3">共享费用明细</h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E5EA]/50 bg-[#F5F5F7]">
                            <th className="text-left py-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">费用类别</th>
                            <th className="text-right py-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">金额</th>
                            <th className="text-left py-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">描述</th>
                            <th className="text-left py-2 text-xs uppercase tracking-wider text-[#6E6E73] font-medium">数据来源</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mergedSharedFees.map((fee, i) => (
                            <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7]">
                              <td className="py-2">{fee.category}</td>
                              <td className="py-2 text-right tabular-nums">${fee.totalAmount.toFixed(2)}</td>
                              <td className="py-2 text-[#6E6E73]">{fee.description}</td>
                              <td className="py-2">
                                <Badge variant="outline" className="text-[10px] border-[#E5E5EA]/50">
                                  {fee.source || 'transaction'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#6E6E73]">
                    请先生成利润表
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}