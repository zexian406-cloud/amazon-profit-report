'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { parseExcel } from '@/lib/excel-parser';
import { calculateSKUProfit } from '@/lib/profit-calculator';
import { saveMonthlyData, saveSharedFees, saveProfitReport } from '@/lib/idb';
import { ParseResult, SKUProfitRow, SharedFee, Reconciliation } from '@/lib/types';
import * as XLSX from 'xlsx';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuRows, setSkuRows] = useState<SKUProfitRow[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [activeTab, setActiveTab] = useState('preview');

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setError('请上传 Excel 文件 (.xlsx, .xls, .csv)');
      return;
    }
    setFile(file);
    setError(null);
    setSaved(false);
    setParsing(true);
    setResult(null);

    try {
      const parseResult = await parseExcel(file);
      setResult(parseResult);
      setActiveTab('preview');
    } catch (err) {
      setError(`解析失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setParsing(false);
    }
  }

  async function handleCalculate() {
    if (!result) return;
    setCalculating(true);
    try {
      const { skuRows: rows, reconciliation: recon } = calculateSKUProfit(
        result.transactions,
        result.sharedFees,
        result.month,
        result.storeName
      );
      setSkuRows(rows);
      setReconciliation(recon);
      setActiveTab('profit');
    } catch (err) {
      setError(`计算失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCalculating(false);
    }
  }

  async function handleSave() {
    if (!result || skuRows.length === 0) return;
    try {
      const monthlyData = {
        month: result.month,
        storeName: result.storeName,
        importDate: new Date().toISOString(),
        fileName: file?.name || '',
        transactions: result.transactions,
      };
      await saveMonthlyData(monthlyData);
      await saveSharedFees(result.sharedFees);
      await saveProfitReport(skuRows);
      setSaved(true);
      setActiveTab('reconciliation');
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  function handleExport() {
    if (!result || skuRows.length === 0) return;
    // 导出Excel
    const wb = XLSX.utils.book_new();

    // Sheet1: SKU利润表
    const ws1Data: (string | number)[][] = [
      [`${result.storeName} ${result.month} SKU利润表`],
      [],
      ['SKU', 'ASIN', '订单量', '退款量', '净销售量', '总销售额', '退款额', '净销售额',
        '总佣金', '退款佣金', '净佣金', '总FBA费', '退款FBA费', '净FBA费',
        '仓储费', '广告费', '入库配置费', '退货处理费', '订阅费(均摊)', '其他费用(均摊)',
        '费用总计', 'SKU净收入', '利润率(%)'],
    ];
    for (const row of skuRows) {
      ws1Data.push([
        row.sku, row.asin, row.orderQuantity, row.refundQuantity, row.orderQuantity - row.refundQuantity,
        row.grossSales, row.refundAmount, row.netSales,
        row.grossCommission, row.refundCommission, row.netCommission,
        row.grossFBAFee, row.refundFBAFee, row.netFBAFee,
        row.storageFee, row.adFee, row.inboundFee, row.returnFee,
        row.subscriptionFee, row.otherFee, row.totalFee, row.netIncome,
        (row.profitMargin * 100).toFixed(2),
      ]);
    }
    // 汇总行
    const totals = {
      orderQuantity: skuRows.reduce((s, r) => s + r.orderQuantity, 0),
      refundQuantity: skuRows.reduce((s, r) => s + r.refundQuantity, 0),
      grossSales: skuRows.reduce((s, r) => s + r.grossSales, 0),
      refundAmount: skuRows.reduce((s, r) => s + r.refundAmount, 0),
      netSales: skuRows.reduce((s, r) => s + r.netSales, 0),
      grossCommission: skuRows.reduce((s, r) => s + r.grossCommission, 0),
      refundCommission: skuRows.reduce((s, r) => s + r.refundCommission, 0),
      netCommission: skuRows.reduce((s, r) => s + r.netCommission, 0),
      grossFBAFee: skuRows.reduce((s, r) => s + r.grossFBAFee, 0),
      refundFBAFee: skuRows.reduce((s, r) => s + r.refundFBAFee, 0),
      netFBAFee: skuRows.reduce((s, r) => s + r.netFBAFee, 0),
      storageFee: skuRows.reduce((s, r) => s + r.storageFee, 0),
      adFee: skuRows.reduce((s, r) => s + r.adFee, 0),
      inboundFee: skuRows.reduce((s, r) => s + r.inboundFee, 0),
      returnFee: skuRows.reduce((s, r) => s + r.returnFee, 0),
      subscriptionFee: skuRows.reduce((s, r) => s + r.subscriptionFee, 0),
      otherFee: skuRows.reduce((s, r) => s + r.otherFee, 0),
      totalFee: skuRows.reduce((s, r) => s + r.totalFee, 0),
      netIncome: skuRows.reduce((s, r) => s + r.netIncome, 0),
    };
    ws1Data.push([]);
    ws1Data.push(['合计', '', totals.orderQuantity, totals.refundQuantity, totals.orderQuantity - totals.refundQuantity,
      totals.grossSales, totals.refundAmount, totals.netSales,
      totals.grossCommission, totals.refundCommission, totals.netCommission,
      totals.grossFBAFee, totals.refundFBAFee, totals.netFBAFee,
      totals.storageFee, totals.adFee, totals.inboundFee, totals.returnFee,
      totals.subscriptionFee, totals.otherFee, totals.totalFee, totals.netIncome, '']);
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = ws1Data[2].map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'SKU利润表');

    // Sheet2: 共享费用
    const ws2Data: (string | number)[][] = [
      [`${result.storeName} ${result.month} 共享费用`],
      [],
      ['费用类别', '金额', '描述'],
    ];
    for (const fee of result.sharedFees) {
      ws2Data.push([fee.category, fee.totalAmount, fee.description]);
    }
    ws2Data.push([]);
    ws2Data.push(['合计', result.sharedFees.reduce((s, f) => s + f.totalAmount, 0), '']);
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, '共享费用');

    // Sheet3: 全局收支核对
    if (reconciliation) {
      const ws3Data: (string | number)[][] = [
        [`${result.storeName} ${result.month} 全局收支核对`],
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
    }

    XLSX.writeFile(wb, `${result.storeName}_${result.month}_利润报表.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据导入</h1>
        <p className="text-sm text-muted-foreground mt-1">
          上传亚马逊交易明细Excel文件，自动解析并生成利润报表
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">上传文件</CardTitle>
          <CardDescription>
            支持亚马逊后台导出的 Settlement 报告或交易明细 (.xlsx, .xls, .csv)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
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
                <p className="text-sm text-muted-foreground">正在解析文件...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                {result && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs">解析完成</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">拖拽文件到此处，或点击上传</p>
                <p className="text-xs text-muted-foreground">支持 .xlsx .xls .csv 格式</p>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="preview">解析预览</TabsTrigger>
            <TabsTrigger value="profit">利润表</TabsTrigger>
            <TabsTrigger value="reconciliation">收支核对</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">解析结果概览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">月份</p>
                    <p className="text-lg font-semibold">{result.month}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">店铺</p>
                    <p className="text-lg font-semibold">{result.storeName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">交易记录</p>
                    <p className="text-lg font-semibold">{result.transactions.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">共享费用</p>
                    <p className="text-lg font-semibold">{result.sharedFees.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">交易分类明细</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium">类型</th>
                        <th className="text-left py-2 px-2 font-medium">SKU</th>
                        <th className="text-right py-2 px-2 font-medium">数量</th>
                        <th className="text-right py-2 px-2 font-medium">金额</th>
                        <th className="text-left py-2 px-2 font-medium">描述</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.transactions.slice(0, 100).map((t, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              t.type === 'Order' ? 'bg-green-100 text-green-700' :
                              t.type === 'Refund' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-2 px-2 max-w-[120px] truncate">{t.sku}</td>
                          <td className="py-2 px-2 text-right">{t.quantity}</td>
                          <td className="py-2 px-2 text-right">${t.totalAmount.toFixed(2)}</td>
                          <td className="py-2 px-2 max-w-[200px] truncate text-muted-foreground">{t.description}</td>
                        </tr>
                      ))}
                      {result.transactions.length > 100 && (
                        <tr>
                          <td colSpan={5} className="text-center py-2 text-muted-foreground text-xs">
                            仅显示前100条，共 {result.transactions.length} 条
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={handleCalculate} disabled={calculating}>
                {calculating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 计算中...</>
                ) : '生成利润表'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="profit" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">SKU利润表</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={skuRows.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    导出Excel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saved}>
                    {saved ? '已保存' : '保存到本地'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {skuRows.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    请先点击"生成利润表"按钮
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">SKU</th>
                          <th className="text-right py-2 px-2 font-medium">订单量</th>
                          <th className="text-right py-2 px-2 font-medium">退款量</th>
                          <th className="text-right py-2 px-2 font-medium">净销售额</th>
                          <th className="text-right py-2 px-2 font-medium">净佣金</th>
                          <th className="text-right py-2 px-2 font-medium">净FBA费</th>
                          <th className="text-right py-2 px-2 font-medium">仓储费</th>
                          <th className="text-right py-2 px-2 font-medium">广告费</th>
                          <th className="text-right py-2 px-2 font-medium">入库配置费</th>
                          <th className="text-right py-2 px-2 font-medium">退货处理费</th>
                          <th className="text-right py-2 px-2 font-medium">订阅费</th>
                          <th className="text-right py-2 px-2 font-medium">其他费</th>
                          <th className="text-right py-2 px-2 font-medium">费用总计</th>
                          <th className="text-right py-2 px-2 font-medium">SKU净收入</th>
                          <th className="text-right py-2 px-2 font-medium">利润率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skuRows.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2 font-medium max-w-[120px] truncate">{row.sku}</td>
                            <td className="py-2 px-2 text-right">{row.orderQuantity}</td>
                            <td className="py-2 px-2 text-right">{row.refundQuantity}</td>
                            <td className="py-2 px-2 text-right">${row.netSales.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.netCommission.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.netFBAFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.storageFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.adFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.inboundFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.returnFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.subscriptionFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.otherFee.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">${row.totalFee.toFixed(2)}</td>
                            <td className={`py-2 px-2 text-right font-semibold ${row.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${row.netIncome.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                row.profitMargin >= 0.2 ? 'bg-green-100 text-green-700' :
                                row.profitMargin >= 0 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">全局收支核对</CardTitle>
              </CardHeader>
              <CardContent>
                {reconciliation ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-xs text-blue-600 font-medium">SKU净收入汇总</p>
                        <p className="text-2xl font-bold text-blue-700">${reconciliation.skuNetIncome.toFixed(2)}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4">
                        <p className="text-xs text-orange-600 font-medium">共享费用汇总</p>
                        <p className="text-2xl font-bold text-orange-700">${reconciliation.sharedFeeTotal.toFixed(2)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-xs text-green-600 font-medium">净收入</p>
                        <p className="text-2xl font-bold text-green-700">${reconciliation.totalNetIncome.toFixed(2)}</p>
                      </div>
                      <div className={`rounded-lg p-4 ${Math.abs(reconciliation.difference) < 0.01 ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="text-xs font-medium">差异</p>
                        <p className={`text-2xl font-bold ${Math.abs(reconciliation.difference) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>
                          ${reconciliation.difference.toFixed(2)}
                        </p>
                        <p className="text-xs mt-1">
                          {Math.abs(reconciliation.difference) < 0.01 ? '✓ 账目平衡' : '⚠ 存在差异'}
                        </p>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-3">共享费用明细</h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">费用类别</th>
                            <th className="text-right py-2 font-medium">金额</th>
                            <th className="text-left py-2 font-medium">描述</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.sharedFees.map((fee, i) => (
                            <tr key={i} className="border-b">
                              <td className="py-2">{fee.category}</td>
                              <td className="py-2 text-right">${fee.totalAmount.toFixed(2)}</td>
                              <td className="py-2 text-muted-foreground">{fee.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
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