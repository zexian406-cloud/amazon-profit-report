'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllMonthlyData, getSharedFees } from '@/lib/idb';
import { calculateSKUProfit } from '@/lib/profit-calculator';
import { MonthlyData, SharedFee, SKUProfitRow, Reconciliation } from '@/lib/types';
import { Search, ArrowUpDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ProfitPage() {
  const [monthlyDataList, setMonthlyDataList] = useState<MonthlyData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [skuRows, setSkuRows] = useState<SKUProfitRow[]>([]);
  const [sharedFees, setSharedFees] = useState<SharedFee[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('sku');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);

  const months = [...new Set(monthlyDataList.map(d => d.month))].sort();
  const stores = [...new Set(monthlyDataList.map(d => d.storeName))];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await getAllMonthlyData();
      setMonthlyDataList(data);
      if (data.length > 0) {
        setSelectedMonth(data[0].month);
        setSelectedStore(data[0].storeName);
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedMonth && selectedStore) {
      calculateProfit();
    }
  }, [selectedMonth, selectedStore]);

  async function calculateProfit() {
    const data = monthlyDataList.find(
      d => d.month === selectedMonth && d.storeName === selectedStore
    );
    if (!data) return;

    const fees = await getSharedFees(selectedMonth, selectedStore);
    setSharedFees(fees);

    const { skuRows: rows, reconciliation: recon } = calculateSKUProfit(
      data.transactions,
      fees,
      selectedMonth,
      selectedStore
    );
    setSkuRows(rows);
    setReconciliation(recon);
  }

  const filteredRows = skuRows
    .filter(row =>
      row.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.asin.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = (a as any)[sortField] || 0;
      const bVal = (b as any)[sortField] || 0;
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleExport() {
    if (skuRows.length === 0) return;
    const wb = XLSX.utils.book_new();

    const ws1Data: (string | number)[][] = [
      [`${selectedStore} ${selectedMonth} SKU利润表`],
      [],
      ['SKU', 'ASIN', '订单量', '退款量', '净销售量', '总销售额', '退款额', '净销售额',
        '总佣金', '退款佣金', '净佣金', '总FBA费', '退款FBA费', '净FBA费',
        '仓储费', '广告费', '入库配置费', '退货处理费', '订阅费(均摊)', '其他费用(均摊)',
        '费用总计', 'SKU净收入', '利润率(%)'],
    ];
    for (const row of skuRows) {
      ws1Data.push([row.sku, row.asin, row.orderQuantity, row.refundQuantity, row.orderQuantity - row.refundQuantity,
        row.grossSales, row.refundAmount, row.netSales,
        row.grossCommission, row.refundCommission, row.netCommission,
        row.grossFBAFee, row.refundFBAFee, row.netFBAFee,
        row.storageFee, row.adFee, row.inboundFee, row.returnFee,
        row.subscriptionFee, row.otherFee, row.totalFee, row.netIncome,
        (row.profitMargin * 100).toFixed(2)]);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = ws1Data[2].map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'SKU利润表');

    // 共享费用
    const ws2Data: (string | number)[][] = [
      [`${selectedStore} ${selectedMonth} 共享费用`],
      [],
      ['费用类别', '金额', '描述'],
    ];
    for (const fee of sharedFees) {
      ws2Data.push([fee.category, fee.totalAmount, fee.description]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, '共享费用');

    if (reconciliation) {
      const ws3Data = [
        [`${selectedStore} ${selectedMonth} 全局收支核对`],
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

    XLSX.writeFile(wb, `${selectedStore}_${selectedMonth}_利润报表.xlsx`);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">加载中...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SKU利润表</h1>
          <p className="text-sm text-muted-foreground mt-1">按SKU维度查看月度利润明细</p>
        </div>
        <Button onClick={handleExport} disabled={skuRows.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          导出Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">选择月份</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="选择月份" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">选择店铺</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="选择店铺" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 max-w-xs">
              <label className="text-xs font-medium">搜索SKU/ASIN</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="输入SKU或ASIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {reconciliation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600">SKU总数</p>
            <p className="text-xl font-bold text-blue-700">{skuRows.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600">净销售额</p>
            <p className="text-xl font-bold text-green-700">
              ${skuRows.reduce((s, r) => s + r.netSales, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs text-indigo-600">净收入</p>
            <p className="text-xl font-bold text-indigo-700">
              ${reconciliation.skuNetIncome.toFixed(2)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-purple-600">平均利润率</p>
            <p className="text-xl font-bold text-purple-700">
              {skuRows.length > 0 ? (skuRows.reduce((s, r) => s + r.profitMargin, 0) / skuRows.length * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b">
                  {['SKU', '订单量', '退款量', '净销售额', '净佣金', '净FBA费', '仓储费', '广告费', '入库配置费', '退货处理费', '订阅费', '其他费', '费用总计', 'SKU净收入', '利润率'].map((header) => (
                    <th
                      key={header}
                      className="text-right py-3 px-2 font-medium cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                      onClick={() => toggleSort(
                        header === 'SKU' ? 'sku' :
                        header === '订单量' ? 'orderQuantity' :
                        header === '退款量' ? 'refundQuantity' :
                        header === '净销售额' ? 'netSales' :
                        header === '净佣金' ? 'netCommission' :
                        header === '净FBA费' ? 'netFBAFee' :
                        header === '仓储费' ? 'storageFee' :
                        header === '广告费' ? 'adFee' :
                        header === '入库配置费' ? 'inboundFee' :
                        header === '退货处理费' ? 'returnFee' :
                        header === '订阅费' ? 'subscriptionFee' :
                        header === '其他费' ? 'otherFee' :
                        header === '费用总计' ? 'totalFee' :
                        header === 'SKU净收入' ? 'netIncome' :
                        'profitMargin'
                      )}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{header}</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 text-left font-medium max-w-[120px] truncate">{row.sku}</td>
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
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="text-center py-8 text-muted-foreground">
                      {skuRows.length === 0 ? '暂无数据，请先导入数据' : '未找到匹配的SKU'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}