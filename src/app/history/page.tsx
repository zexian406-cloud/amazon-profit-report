'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllMonthlyData, getSharedFees } from '@/lib/idb';
import { calculateSKUProfit } from '@/lib/profit-calculator';
import { MonthlyData } from '@/lib/types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';

export default function HistoryPage() {
  const [monthlyDataList, setMonthlyDataList] = useState<MonthlyData[]>([]);
  const [selectedStore, setSelectedStore] = useState('一店');
  const [loading, setLoading] = useState(true);
  const [monthComparisons, setMonthComparisons] = useState<{
    month: string;
    sales: number;
    income: number;
    margin: number;
    skuCount: number;
    orderCount: number;
  }[]>([]);

  const stores = ['全部', ...new Set(monthlyDataList.map(d => d.storeName))];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (monthlyDataList.length > 0) {
      buildComparison();
    }
  }, [selectedStore, monthlyDataList]);

  async function loadData() {
    try {
      const data = await getAllMonthlyData();
      setMonthlyDataList(data);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }

  async function buildComparison() {
    const storeData = selectedStore === '全部'
      ? monthlyDataList
      : monthlyDataList.filter(d => d.storeName === selectedStore);

    const monthMap = new Map<string, {
      sales: number; income: number; orders: number; refunds: number; skuSet: Set<string>
    }>();

    for (const data of storeData) {
      const fees = await getSharedFees(data.month, data.storeName);
      const { skuRows, reconciliation } = calculateSKUProfit(data.transactions, fees, data.month, data.storeName);

      const orders = data.transactions.filter(t => t.type === 'Order');
      const sales = orders.reduce((s, t) => s + t.totalAmount, 0);
      const refunds = data.transactions.filter(t => t.type === 'Refund');
      const refundSales = refunds.reduce((s, t) => s + Math.abs(t.totalAmount), 0);

      const existing = monthMap.get(data.month) || { sales: 0, income: 0, orders: 0, refunds: 0, skuSet: new Set<string>() };
      existing.sales += sales;
      existing.income += reconciliation.skuNetIncome;
      existing.orders += orders.length;
      existing.refunds += refunds.length;
      skuRows.forEach(r => existing.skuSet.add(r.sku));
      monthMap.set(data.month, existing);
    }

    const comparisons: any[] = [];
    for (const [month, v] of monthMap) {
      comparisons.push({
        month,
        sales: Math.round(v.sales * 100) / 100,
        income: Math.round(v.income * 100) / 100,
        margin: v.sales !== 0 ? Math.round((v.income / v.sales) * 10000) / 100 : 0,
        skuCount: v.skuSet.size,
        orderCount: v.orders - v.refunds,
      });
    }

    comparisons.sort((a, b) => a.month.localeCompare(b.month));
    setMonthComparisons(comparisons);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">加载中...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">历史对比</h1>
          <p className="text-sm text-muted-foreground mt-1">多月份利润数据对比分析</p>
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="选择店铺" />
          </SelectTrigger>
          <SelectContent>
            {stores.map(s => (
              <SelectItem key={s} value={s}>{s === '全部' ? '全部店铺' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {monthComparisons.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            暂无对比数据，请先导入多个月份的数据
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">销售额与净收入对比</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthComparisons}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                      <Legend />
                      <Bar dataKey="sales" name="销售额" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="income" name="净收入" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">利润率变化趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthComparisons}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '利润率']} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="margin"
                        name="利润率"
                        stroke="#1e3a5f"
                        strokeWidth={2}
                        dot={{ fill: '#1e3a5f', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">逐月对比明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">月份</th>
                      <th className="text-right py-3 px-2 font-medium">订单数</th>
                      <th className="text-right py-3 px-2 font-medium">SKU数</th>
                      <th className="text-right py-3 px-2 font-medium">销售额</th>
                      <th className="text-right py-3 px-2 font-medium">净收入</th>
                      <th className="text-right py-3 px-2 font-medium">利润率</th>
                      <th className="text-right py-3 px-2 font-medium">环比变化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthComparisons.map((m, i) => {
                      const prev = i > 0 ? monthComparisons[i - 1] : null;
                      const change = prev ? ((m.income - prev.income) / Math.abs(prev.income || 1) * 100) : 0;
                      return (
                        <tr key={m.month} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{m.month}</td>
                          <td className="py-3 px-2 text-right">{m.orderCount}</td>
                          <td className="py-3 px-2 text-right">{m.skuCount}</td>
                          <td className="py-3 px-2 text-right">${m.sales.toFixed(2)}</td>
                          <td className={`py-3 px-2 text-right font-semibold ${m.income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${m.income.toFixed(2)}
                          </td>
                          <td className="py-3 px-2 text-right">{m.margin.toFixed(1)}%</td>
                          <td className="py-3 px-2 text-right">
                            {prev ? (
                              <span className={`flex items-center justify-end gap-1 text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {Math.abs(change).toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}