'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllMonthlyData, getSharedFees } from '@/lib/idb';
import { calculateSKUProfit } from '@/lib/profit-calculator';
import { MonthlyData, SharedFee, SKUProfitRow } from '@/lib/types';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6', '#AF52DE', '#FF6482', '#00C7BE'];

export default function FeesPage() {
  const [monthlyDataList, setMonthlyDataList] = useState<MonthlyData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>('全部');
  const [loading, setLoading] = useState(true);
  const [skuRows, setSkuRows] = useState<SKUProfitRow[]>([]);
  const [sharedFees, setSharedFees] = useState<SharedFee[]>([]);

  const months = [...new Set(monthlyDataList.map(d => d.month))].sort();
  const stores = ['全部', ...new Set(monthlyDataList.map(d => d.storeName))];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedStore) {
      loadFees();
    }
  }, [selectedMonth, selectedStore, monthlyDataList]);

  async function loadData() {
    try {
      const data = await getAllMonthlyData();
      setMonthlyDataList(data);
      if (data.length > 0) {
        setSelectedMonth(data[0].month);
        setSelectedStore('全部');
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFees() {
    if (selectedStore === '全部') {
      const storeNames = [...new Set(monthlyDataList.map(d => d.storeName))];
      let allRows: SKUProfitRow[] = [];
      let allFees: SharedFee[] = [];

      for (const store of storeNames) {
        const data = monthlyDataList.find(
          d => d.month === selectedMonth && d.storeName === store
        );
        if (!data) continue;
        const fees = await getSharedFees(selectedMonth, store);
        const { skuRows: rows } = calculateSKUProfit(data.transactions, fees, selectedMonth, store);
        allRows.push(...rows);
        allFees = [...allFees, ...fees];
      }
      setSkuRows(allRows);
      setSharedFees(allFees);
    } else {
      const data = monthlyDataList.find(
        d => d.month === selectedMonth && d.storeName === selectedStore
      );
      if (!data) return;

      const fees = await getSharedFees(selectedMonth, selectedStore);
      setSharedFees(fees);

      const { skuRows: rows } = calculateSKUProfit(data.transactions, fees, selectedMonth, selectedStore);
      setSkuRows(rows);
    }
  }

  // 费用结构数据
  const feeStructure = [
    { name: 'FBA费', value: Math.abs(skuRows.reduce((s, r) => s + r.netFBAFee, 0)) },
    { name: '佣金', value: Math.abs(skuRows.reduce((s, r) => s + r.netCommission, 0)) },
    { name: '仓储费', value: Math.abs(skuRows.reduce((s, r) => s + r.totalStorageFee, 0)) },
    { name: '广告费', value: Math.abs(skuRows.reduce((s, r) => s + r.adFee, 0)) },
    { name: '入库配置费', value: Math.abs(skuRows.reduce((s, r) => s + r.inboundFee, 0)) },
    { name: '退货处理费', value: Math.abs(skuRows.reduce((s, r) => s + r.returnFee, 0)) },
    { name: '订阅费', value: Math.abs(skuRows.reduce((s, r) => s + r.subscriptionFee, 0)) },
    { name: '其他', value: Math.abs(skuRows.reduce((s, r) => s + r.otherAdjustment, 0)) },
  ].filter(f => f.value > 0);

  const totalFee = feeStructure.reduce((s, f) => s + f.value, 0);

  // 共享费用明细
  const sharedFeeData = [
    ...sharedFees.map(f => ({
      name: f.category,
      value: Math.abs(f.totalAmount),
    })),
  ].filter(f => f.value > 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-[#6E6E73]">加载中...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">费用分析</h1>
          <p className="text-sm text-[#6E6E73] mt-1">费用结构拆解与明细分析</p>
        </div>
        <div className="flex gap-2">
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
      </div>

      {skuRows.length === 0 ? (
        <Card className="border-0 rounded-2xl apple-card">
          <CardContent className="text-center py-12 text-[#6E6E73]">
            暂无数据，请先导入数据
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">总费用</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalFee.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">最大费用项</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {feeStructure.length > 0 ? feeStructure[0].name : '-'}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">费用占比</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {feeStructure.length > 0 && totalFee > 0
                    ? `${((feeStructure[0].value / totalFee) * 100).toFixed(1)}%`
                    : '-'}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">共享费用项</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sharedFeeData.length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* 费用结构饼图 */}
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader>
                <CardTitle className="text-base">费用结构分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={feeStructure}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      >
                        {feeStructure.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '金额']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 费用对比柱状图 */}
            <Card className="border-0 rounded-2xl apple-card">
              <CardHeader>
                <CardTitle className="text-base">各项费用明细</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={feeStructure} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '金额']} />
                      <Bar dataKey="value" name="费用" radius={[0, 4, 4, 0]}>
                        {feeStructure.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 共享费用明细 */}
          <Card className="border-0 rounded-2xl apple-card">
            <CardHeader>
              <CardTitle className="text-base">共享费用明细</CardTitle>
            </CardHeader>
            <CardContent>
              {sharedFeeData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">费用类别</th>
                        <th className="text-right py-3 px-2 font-medium">金额</th>
                        <th className="text-left py-3 px-2 font-medium">描述</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedFees.map((fee, i) => (
                        <tr key={i} className="border-b hover:bg-[#F5F5F7]">
                          <td className="py-3 px-2">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#F5F5F7]">
                              {fee.category}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-medium">${fee.totalAmount.toFixed(2)}</td>
                          <td className="py-3 px-2 text-[#6E6E73]">{fee.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-[#6E6E73]">暂无共享费用数据</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}