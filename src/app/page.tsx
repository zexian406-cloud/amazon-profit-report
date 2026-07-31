'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllMonthlyData, getHistoryMonths } from '@/lib/idb';
import { HistoryMonth, SKUProfitRow } from '@/lib/types';
import { getMonthlyTrends } from '@/lib/profit-calculator';
import { TrendingUp, TrendingDown, DollarSign, Package, Percent } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const [months, setMonths] = useState<HistoryMonth[]>([]);
  const [trends, setTrends] = useState<{ months: string[]; salesData: number[]; incomeData: number[]; marginData: number[] }>({
    months: [], salesData: [], incomeData: [], marginData: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const historyMonths = await getHistoryMonths();
      setMonths(historyMonths);

      const allData = await getAllMonthlyData();
      // 模拟利润报表数据用于趋势
      const allReports: SKUProfitRow[] = [];
      for (const data of allData) {
        const orders = data.transactions.filter(t => t.type === 'Order');
        const refunds = data.transactions.filter(t => t.type === 'Refund');
        const netSales = orders.reduce((s, t) => s + t.totalAmount, 0) + refunds.reduce((s, t) => s + t.totalAmount, 0);
        allReports.push({
          sku: 'ALL',
          asin: '',
          storeName: data.storeName,
          month: data.month,
          orderQuantity: orders.length,
          refundQuantity: refunds.length,
          grossSales: orders.reduce((s, t) => s + t.totalAmount, 0),
          refundAmount: refunds.reduce((s, t) => s + t.totalAmount, 0),
          netSales,
          grossCommission: 0,
          refundCommission: 0,
          netCommission: 0,
          grossFBAFee: 0,
          refundFBAFee: 0,
          netFBAFee: 0,
          storageFee: 0,
          adFee: 0,
          inboundFee: 0,
          returnFee: 0,
          subscriptionFee: 0,
          otherFee: 0,
          totalFee: 0,
          netIncome: netSales,
          profitMargin: netSales > 0 ? 1 : 0,
        });
      }
      setTrends(getMonthlyTrends(allReports));
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  const totalSales = months.reduce((s, m) => s + m.totalSales, 0);
  const totalNetIncome = months.reduce((s, m) => s + m.totalNetIncome, 0);
  const avgMargin = months.length > 0
    ? months.reduce((s, m) => s + m.profitMargin, 0) / months.length
    : 0;
  const totalSKU = months.reduce((s, m) => s + m.skuCount, 0);

  const chartData = trends.months.map((m, i) => ({
    month: m,
    sales: trends.salesData[i] || 0,
    income: trends.incomeData[i] || 0,
    margin: ((trends.marginData[i] || 0) * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">总览看板</h1>
        <p className="text-sm text-muted-foreground mt-1">
          亚马逊利润数据总览，共 {months.length} 个月数据
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总销售额</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              累计 {months.length} 个月
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">净收入</CardTitle>
            {totalNetIncome >= 0
              ? <TrendingUp className="h-4 w-4 text-green-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />
            }
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalNetIncome.toFixed(2)}</div>
            <p className={`text-xs mt-1 ${totalNetIncome >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalNetIncome >= 0 ? '盈利' : '亏损'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">平均利润率</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgMargin * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              平均 {avgMargin >= 0 ? '盈利' : '亏损'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SKU总数</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSKU}</div>
            <p className="text-xs text-muted-foreground mt-1">
              累计管理SKU
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">销售额与利润趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="sales" name="销售额" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="income" name="净收入" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">利润率变化趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip
                    formatter={(value: string) => [`${value}%`, '利润率']}
                  />
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

      {/* Recent Months */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">月度数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">月份</th>
                  <th className="text-right py-3 px-2 font-medium">店铺</th>
                  <th className="text-right py-3 px-2 font-medium">总销售额</th>
                  <th className="text-right py-3 px-2 font-medium">净收入</th>
                  <th className="text-right py-3 px-2 font-medium">利润率</th>
                  <th className="text-right py-3 px-2 font-medium">SKU数</th>
                </tr>
              </thead>
              <tbody>
                {months.slice(0, 12).map((m) => (
                  <tr key={`${m.month}-${m.storeName}`} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{m.month}</td>
                    <td className="py-3 px-2 text-right">{m.storeName}</td>
                    <td className="py-3 px-2 text-right">${m.totalSales.toFixed(2)}</td>
                    <td className={`py-3 px-2 text-right ${m.totalNetIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${m.totalNetIncome.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right">{m.profitMargin.toFixed(1)}%</td>
                    <td className="py-3 px-2 text-right">{m.skuCount}</td>
                  </tr>
                ))}
                {months.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无数据，请先导入亚马逊交易明细
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