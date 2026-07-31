'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllMonthlyData, getAllProfitReports } from '@/lib/idb';
import { MonthlyData, SKUProfitRow, ALL_STORES, SHOPS, SHOP_COLORS, getShopLabel, getShopKey } from '@/lib/types';
import { ShopFilter } from '@/components/layout/shop-filter';
import { TrendingUp, DollarSign, Package, Percent } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Helper: compute totals from MonthlyData's transactions
function computeMonthlyTotals(d: MonthlyData) {
  const txns = d.transactions || [];
  let totalSales = 0;
  let totalFee = 0;
  let totalNetIncome = 0;
  const skuSet = new Set<string>();

  txns.forEach(t => {
    if (t.type === 'Order' && (t.totalAmount || 0) > 0) {
      totalSales += t.totalAmount || 0;
    }
    // Fees are negative amounts
    if (t.totalAmount && t.totalAmount < 0) {
      totalFee += t.totalAmount;
    }
    if (t.sku) skuSet.add(t.sku);
  });

  totalNetIncome = totalSales + totalFee;
  const profitRate = totalSales > 0 ? (totalNetIncome / totalSales) * 100 : 0;

  return {
    totalSales,
    totalNetIncome,
    skuCount: skuSet.size,
    profitRate,
  };
}

export default function DashboardPage() {
  const [allData, setAllData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState<string>(ALL_STORES);

  const availableStores = useMemo(() => {
    const storeSet = new Set<string>();
    allData.forEach(d => {
      if (d.storeName) storeSet.add(d.storeName);
    });
    return Array.from(storeSet).sort();
  }, [allData]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await getAllMonthlyData();
      setAllData(data);
    } catch (e) {
      console.error('加载数据失败:', e);
    } finally {
      setLoading(false);
    }
  }

  // Filter data by store
  const filteredData = useMemo(() => {
    if (storeFilter === ALL_STORES) return allData;
    return allData.filter(d => d.storeName === storeFilter);
  }, [allData, storeFilter]);

  // Aggregate months data with computed totals
  const monthAggMap = useMemo(() => {
    const map = new Map<string, {
      months: Set<string>;
      stores: Set<string>;
      totalSales: number;
      totalNetIncome: number;
      totalSkuCount: number;
      totalProfitRate: number;
      monthCount: number;
    }>();

    filteredData.forEach(d => {
      const totals = computeMonthlyTotals(d);
      if (!map.has(d.month)) {
        map.set(d.month, {
          months: new Set(),
          stores: new Set(),
          totalSales: 0,
          totalNetIncome: 0,
          totalSkuCount: 0,
          totalProfitRate: 0,
          monthCount: 0,
        });
      }
      const item = map.get(d.month)!;
      item.months.add(d.month);
      if (d.storeName) item.stores.add(d.storeName);
      item.totalSales += totals.totalSales;
      item.totalNetIncome += totals.totalNetIncome;
      item.totalSkuCount += totals.skuCount;
      item.totalProfitRate += totals.profitRate;
      item.monthCount += 1;
    });

    return map;
  }, [filteredData]);

  // Trend data for charts
  const trendData = useMemo(() => {
    const months = Array.from(monthAggMap.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    return months.map(([month, item]) => ({
      month,
      totalSales: item.totalSales,
      netIncome: item.totalNetIncome,
      profitRate: item.monthCount > 0
        ? item.totalProfitRate / item.monthCount
        : 0,
      skuCount: item.totalSkuCount,
    }));
  }, [monthAggMap]);

  // Multi-store trend data for comparison
  const multiStoreTrendData = useMemo(() => {
    const months = Array.from(new Set(allData.map(d => d.month))).sort();
    const storeNames = Array.from(new Set(allData.map(d => d.storeName || '一店'))).sort();

    return months.map(month => {
      const point: Record<string, string | number> = { month };
      storeNames.forEach(store => {
        const monthData = allData.filter(d => d.month === month && d.storeName === store);
        const totals = monthData.reduce(
          (acc, d) => {
            const t = computeMonthlyTotals(d);
            return { totalSales: acc.totalSales + t.totalSales, totalNetIncome: acc.totalNetIncome + t.totalNetIncome };
          },
          { totalSales: 0, totalNetIncome: 0 }
        );
        point[`${store}_sales`] = totals.totalSales;
        point[`${store}_income`] = totals.totalNetIncome;
      });
      return point;
    });
  }, [allData]);

  const storeNames = useMemo(() =>
    Array.from(new Set(allData.map(d => d.storeName || '一店'))).sort(),
    [allData]
  );

  // KPI calculations
  const kpis = useMemo(() => {
    let totalSales = 0;
    let totalNetIncome = 0;
    let totalSkuCount = 0;
    let totalProfitRate = 0;
    let count = 0;

    filteredData.forEach(d => {
      const totals = computeMonthlyTotals(d);
      totalSales += totals.totalSales;
      totalNetIncome += totals.totalNetIncome;
      totalSkuCount += totals.skuCount;
      totalProfitRate += totals.profitRate;
      count++;
    });

    return {
      totalSales,
      totalNetIncome,
      totalSkuCount,
      avgProfitRate: count > 0 ? totalProfitRate / count : 0,
    };
  }, [filteredData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>总览看板</h1>
          <p className="text-sm text-muted-foreground">多店铺利润数据汇总与分析</p>
        </div>
        <div className="flex items-center gap-3">
          <ShopFilter
            stores={availableStores}
            value={storeFilter}
            onChange={setStoreFilter}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总销售额</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{kpis.totalSales.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">全部店铺汇总</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">净收入</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: kpis.totalNetIncome >= 0 ? '#10b981' : '#ef4444' }}>
              ¥{kpis.totalNetIncome.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">总收入 - 总费用</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">平均利润率</CardTitle>
            <Percent className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: kpis.avgProfitRate >= 0 ? '#10b981' : '#ef4444' }}>
              {kpis.avgProfitRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">加权平均</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SKU总数</CardTitle>
            <Package className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalSkuCount}</div>
            <p className="text-xs text-muted-foreground">全部店铺</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">销售额趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {storeFilter === ALL_STORES && storeNames.length > 1 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={multiStoreTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                <Legend />
                {storeNames.map((store, i) => (
                  <Line
                    key={store}
                    type="monotone"
                    dataKey={`${store}_sales`}
                    name={store}
                    stroke={SHOP_COLORS[getShopKey(store)] || ['#1e3a5f', '#3b82f6', '#f59e0b'][i % 3]}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="totalSales" name="销售额" stroke="#1e3a5f" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Profit Rate & Net Income */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">净收入趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {storeFilter === ALL_STORES && storeNames.length > 1 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={multiStoreTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                  <Legend />
                  {storeNames.map((store, i) => (
                    <Line
                      key={store}
                      type="monotone"
                      dataKey={`${store}_income`}
                      name={`${store}净收入`}
                      stroke={SHOP_COLORS[getShopKey(store)] || ['#10b981', '#8b5cf6', '#f59e0b'][i % 3]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="netIncome" name="净收入" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">利润率变化</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="profitRate" name="利润率" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly data table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">月度数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-2 font-medium">月份</th>
                  <th className="py-2 px-2 font-medium">店铺</th>
                  <th className="py-2 px-2 text-right font-medium">销售额</th>
                  <th className="py-2 px-2 text-right font-medium">净收入</th>
                  <th className="py-2 px-2 text-right font-medium">利润率</th>
                  <th className="py-2 px-2 text-right font-medium">SKU数</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice().sort((a, b) => b.month.localeCompare(a.month)).map((d, i) => {
                  const totals = computeMonthlyTotals(d);
                  return (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">{d.month}</td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${SHOP_COLORS[getShopKey(d.storeName)] || '#6b7280'}15`,
                            color: SHOP_COLORS[getShopKey(d.storeName)] || '#6b7280',
                          }}
                        >
                          {d.storeName || '一店'}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2">
                        ¥{totals.totalSales.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2 px-2">
                        <span style={{ color: totals.totalNetIncome >= 0 ? '#10b981' : '#ef4444' }}>
                          ¥{totals.totalNetIncome.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2">{totals.profitRate.toFixed(1)}%</td>
                      <td className="text-right py-2 px-2">{totals.skuCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}