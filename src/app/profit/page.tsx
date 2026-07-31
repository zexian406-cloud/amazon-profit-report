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

const COLUMNS = [
  { key: 'sku', label: 'SKU', type: 'string' },
  { key: 'orderQuantity', label: '订单量', type: 'number' },
  { key: 'refundQuantity', label: '退款量', type: 'number' },
  { key: 'productSales', label: '商品销售收入', type: 'currency' },
  { key: 'shippingIncome', label: '运费收入', type: 'currency' },
  { key: 'liquidationValue', label: '清算残值收入', type: 'currency' },
  { key: 'refundProduct', label: '退款-商品', type: 'currency' },
  { key: 'refundShipping', label: '退款-运费', type: 'currency' },
  { key: 'refundPromo', label: '退款-促销回冲', type: 'currency' },
  { key: 'promoDiscount', label: '促销折扣', type: 'currency' },
  { key: 'netSales', label: '▶ 净销售额', type: 'currency', bold: true },
  { key: 'salesCommission', label: '销售佣金', type: 'currency' },
  { key: 'refundCommission', label: '退款-佣金退回', type: 'currency' },
  { key: 'couponFee', label: 'Coupon费', type: 'currency' },
  { key: 'netCommission', label: '▶ 净佣金', type: 'currency', bold: true },
  { key: 'fbaDeliveryFee', label: 'FBA配送费', type: 'currency' },
  { key: 'refundFBAFee', label: '退款-FBA费退回', type: 'currency' },
  { key: 'returnFee', label: '退货处理费', type: 'currency' },
  { key: 'inboundAbnormalFee', label: '入库异常费', type: 'currency' },
  { key: 'netFBAFee', label: '▶ 净FBA费', type: 'currency', bold: true },
  { key: 'monthlyStorageFee', label: '月度仓储费', type: 'currency' },
  { key: 'agedSurcharge', label: '超龄附加费', type: 'currency' },
  { key: 'totalStorageFee', label: '▶ 仓储费合计', type: 'currency', bold: true },
  { key: 'liquidationFee', label: '清算手续费', type: 'currency' },
  { key: 'inventoryCompensation', label: '库存赔偿', type: 'currency' },
  { key: 'safeTClaim', label: 'SAFE-T赔付', type: 'currency' },
  { key: 'refundOther', label: '退款-其他', type: 'currency' },
  { key: 'returnShippingFee', label: '退货运费', type: 'currency' },
  { key: 'disposalFee', label: '弃置费', type: 'currency' },
  { key: 'subscriptionFee', label: '订阅费(均摊)', type: 'currency' },
  { key: 'otherAdjustment', label: '其他调整（均摊）', type: 'currency' },
  { key: 'inboundFee', label: '入库配置费', type: 'currency' },
  { key: 'removalFee', label: '订单移除费', type: 'currency' },
  { key: 'adFee', label: '广告费', type: 'currency' },
  { key: 'headHaul', label: '头程', type: 'currency' },
  { key: 'productCost', label: '成本', type: 'currency' },
  { key: 'legangDelivery', label: '乐歌尾程', type: 'currency' },
  { key: 'jingdongDelivery', label: '京东尾程', type: 'currency' },
  { key: 'fakeOrderFee', label: '刷单费', type: 'currency' },
  { key: 'netIncome', label: '▶ SKU净收入', type: 'currency', bold: true },
  { key: 'profitMargin', label: '利润率', type: 'percent' },
  { key: 'manager', label: '负责人', type: 'string' },
];

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
      const aVal = (a as any)[sortField] ?? 0;
      const bVal = (b as any)[sortField] ?? 0;
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

  function formatVal(row: SKUProfitRow, col: typeof COLUMNS[0]) {
    const val = (row as any)[col.key];
    if (val === undefined || val === null || val === '') return '-';
    if (col.type === 'currency') {
      const v = val as number;
      return v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;
    }
    if (col.type === 'percent') {
      return `${((val as number) * 100).toFixed(1)}%`;
    }
    return val;
  }

  function handleExport() {
    if (skuRows.length === 0) return;
    const wb = XLSX.utils.book_new();

    const ws1Data: (string | number)[][] = [
      [`${selectedStore} ${selectedMonth} SKU利润表`],
      [],
      COLUMNS.map(c => c.label),
    ];
    for (const row of skuRows) {
      ws1Data.push(
        COLUMNS.map(c => {
          const val = (row as any)[c.key];
          if (c.type === 'percent') return Math.round((val as number) * 10000) / 100;
          if (typeof val === 'number') return Math.round(val * 100) / 100;
          return val ?? '';
        })
      );
    }
    // 合计行
    const sum = (fn: (r: SKUProfitRow) => number) => Math.round(skuRows.reduce((s, r) => s + fn(r), 0) * 100) / 100;
    ws1Data.push([]);
    ws1Data.push(COLUMNS.map(c => {
      if (c.key === 'sku') return '合计';
      if (c.key === 'manager') return '';
      if (c.type === 'percent') return '';
      const numKey = c.key as keyof SKUProfitRow;
      const v = rowSums[numKey as string];
      return typeof v === 'number' ? Math.round(v * 100) / 100 : '';
    }));

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = COLUMNS.map(() => ({ wch: 14 }));
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

  const rowSums = COLUMNS.reduce((acc, c) => {
    if (c.type === 'currency' || c.type === 'number') {
      acc[c.key] = skuRows.reduce((s, r) => s + ((r as any)[c.key] || 0), 0);
    }
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">加载中...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SKU利润表</h1>
          <p className="text-sm text-muted-foreground mt-1">按SKU维度查看月度利润明细（41列模板）</p>
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
              <label className="text-xs font-medium">搜索SKU</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="输入SKU..."
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
              ${rowSums['netSales']?.toFixed(2) || '0.00'}
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
                  <th className="text-left py-3 px-2 font-medium whitespace-nowrap min-w-[100px] sticky left-0 bg-white z-20">SKU</th>
                  {COLUMNS.slice(1).map((col) => (
                    <th
                      key={col.key}
                      className={`text-right py-3 px-2 font-medium cursor-pointer hover:bg-muted/50 whitespace-nowrap ${col.bold ? 'text-blue-700' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{col.label}</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 text-left font-medium max-w-[120px] truncate sticky left-0 bg-white">
                      {row.sku}
                    </td>
                    {COLUMNS.slice(1).map((col) => {
                      const val = (row as any)[col.key];
                      if (col.key === 'profitMargin') {
                        return (
                          <td key={col.key} className="py-2 px-2 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              val >= 0.2 ? 'bg-green-100 text-green-700' :
                              val >= 0 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {(val * 100).toFixed(1)}%
                            </span>
                          </td>
                        );
                      }
                      if (col.key === 'netIncome') {
                        return (
                          <td key={col.key} className={`py-2 px-2 text-right font-semibold ${val >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatVal(row, col)}
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className={`py-2 px-2 text-right ${col.bold ? 'font-semibold' : ''}`}>
                          {formatVal(row, col)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="text-center py-8 text-muted-foreground">
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