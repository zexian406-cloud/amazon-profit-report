'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllMonthlyData, getAllProfitReports, getExchangeRates, getExchangeRateOverrides } from '@/lib/idb';
import { MonthlyData, SKUProfitRow, ALL_STORES, getShopLabel, getShopColor, CURRENCY_OPTIONS, getCurrencySymbol, ExchangeRateOverride } from '@/lib/types';
import { convertAmountWithOverrides, ExchangeRate } from '@/lib/currency';
import { ShopFilter } from '@/components/layout/shop-filter';
import { useShops } from '@/hooks/use-shops';
import { TrendingUp, DollarSign, Package, Percent, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
  const [displayCurrency, setDisplayCurrency] = useState('CNY');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [exchangeRateOverrides, setExchangeRateOverrides] = useState<ExchangeRateOverride[]>([]);

  const { shops } = useShops();

  useEffect(() => {
    loadData();
    loadExchangeRates();
  }, []);

  async function loadExchangeRates() {
    try {
      const [rates, overrides] = await Promise.all([
        getExchangeRates(),
        getExchangeRateOverrides(),
      ]);
      setExchangeRates(rates);
      setExchangeRateOverrides(overrides);
    } catch (e) {
      console.error('加载汇率失败:', e);
    }
  }

  function convert(val: number, fromCurrency: string = 'USD', month?: string) {
    return convertAmountWithOverrides(val, fromCurrency, displayCurrency, exchangeRates, exchangeRateOverrides, month || '');
  }

  const currencySymbol = getCurrencySymbol(displayCurrency);

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

  const filteredData = useMemo(() => {
    if (storeFilter === ALL_STORES) return allData;
    return allData.filter(d => d.storeName === storeFilter);
  }, [allData, storeFilter]);

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
        <div className="grid gap-5 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">概览</h1>
          <p className="text-sm text-[#6E6E73] mt-1">多店铺利润数据汇总</p>
        </div>
        <div className="flex items-center gap-3">
          <ShopFilter
            value={storeFilter}
            onChange={setStoreFilter}
          />
          <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
            <SelectTrigger className="w-28 h-9 rounded-xl border-border/50 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Apple-style KPI Cards - large numbers, minimal labels */}
      <div className="grid gap-5 md:grid-cols-4">
        <Card className="border-0 rounded-2xl apple-card">
          <CardContent className="p-6">
            <p className="text-xs font-medium text-[#6E6E73] uppercase tracking-wider mb-2">总销售额</p>
            <p className="text-3xl font-semibold tabular-nums text-[#1D1D1F]">
              {currencySymbol}{convert(kpis.totalSales, 'USD').toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-[#6E6E73]/60 mt-2">全部店铺汇总</p>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-2xl apple-card">
          <CardContent className="p-6">
            <p className="text-xs font-medium text-[#6E6E73] uppercase tracking-wider mb-2">净收入</p>
            <p className={`text-3xl font-semibold tabular-nums ${kpis.totalNetIncome >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
              {currencySymbol}{convert(kpis.totalNetIncome, 'USD').toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-[#6E6E73]/60 mt-2 flex items-center gap-1">
              {kpis.totalNetIncome >= 0 ? (
                <><ArrowUpRight className="h-3 w-3 text-[#34C759]" /> 盈利</>
              ) : (
                <><ArrowDownRight className="h-3 w-3 text-[#FF3B30]" /> 亏损</>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-2xl apple-card">
          <CardContent className="p-6">
            <p className="text-xs font-medium text-[#6E6E73] uppercase tracking-wider mb-2">平均利润率</p>
            <p className={`text-3xl font-semibold tabular-nums ${kpis.avgProfitRate >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
              {kpis.avgProfitRate.toFixed(1)}%
            </p>
            <p className="text-xs text-[#6E6E73]/60 mt-2">加权平均</p>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-2xl apple-card">
          <CardContent className="p-6">
            <p className="text-xs font-medium text-[#6E6E73] uppercase tracking-wider mb-2">SKU 总数</p>
            <p className="text-3xl font-semibold tabular-nums text-[#1D1D1F]">
              {kpis.totalSkuCount}
            </p>
            <p className="text-xs text-[#6E6E73]/60 mt-2">全部店铺</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <Card className="border-0 rounded-2xl apple-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-[#1D1D1F]">销售额趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              {storeFilter === ALL_STORES && storeNames.length > 1 ? (
                <LineChart data={multiStoreTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6E6E73' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6E6E73' }} />
                  <Tooltip
                    formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  {storeNames.map((store, i) => (
                    <Line
                      key={store}
                      type="monotone"
                      dataKey={`${store}_sales`}
                      name={store}
                      stroke={getShopColor(store)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6E6E73' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6E6E73' }} />
                  <Tooltip
                    formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '销售额']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="totalSales" name="销售额" stroke="#007AFF" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Profit Rate & Net Income */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-0 rounded-2xl apple-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-[#1D1D1F]">净收入趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {storeFilter === ALL_STORES && storeNames.length > 1 ? (
                  <LineChart data={multiStoreTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6E6E73' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6E6E73' }} />
                    <Tooltip
                      formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '']}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    {storeNames.map((store, i) => (
                      <Line
                        key={store}
                        type="monotone"
                        dataKey={`${store}_income`}
                        name={`${store}净收入`}
                        stroke={getShopColor(store)}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6E6E73' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6E6E73' }} />
                    <Tooltip
                      formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '净收入']}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="netIncome" name="净收入" fill="#007AFF" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-2xl apple-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-[#1D1D1F]">利润率变化</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6E6E73' }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12, fill: '#6E6E73' }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, '利润率']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="profitRate" name="利润率" stroke="#34C759" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly data table */}
      <Card className="border-0 rounded-2xl apple-card overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-[#1D1D1F]">月度数据</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5EA]">
                  <th className="py-3 px-6 text-left text-xs font-medium text-[#6E6E73] uppercase tracking-wider">月份</th>
                  <th className="py-3 px-6 text-left text-xs font-medium text-[#6E6E73] uppercase tracking-wider">店铺</th>
                  <th className="py-3 px-6 text-right text-xs font-medium text-[#6E6E73] uppercase tracking-wider">销售额</th>
                  <th className="py-3 px-6 text-right text-xs font-medium text-[#6E6E73] uppercase tracking-wider">净收入</th>
                  <th className="py-3 px-6 text-right text-xs font-medium text-[#6E6E73] uppercase tracking-wider">利润率</th>
                  <th className="py-3 px-6 text-right text-xs font-medium text-[#6E6E73] uppercase tracking-wider">SKU数</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice().sort((a, b) => b.month.localeCompare(a.month)).map((d, i) => {
                  const totals = computeMonthlyTotals(d);
                  return (
                    <tr key={i} className="border-b border-[#E5E5EA]/50 hover:bg-[#F5F5F7] transition-colors">
                      <td className="py-3.5 px-6 text-sm text-[#1D1D1F]">{d.month}</td>
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
                          style={{
                            backgroundColor: `${getShopColor(d.storeName)}15`,
                            color: getShopColor(d.storeName),
                          }}
                        >
                          {d.storeName || '一店'}
                        </span>
                      </td>
                      <td className="text-right py-3.5 px-6 tabular-nums text-sm text-[#1D1D1F]">
                        {currencySymbol}{convert(totals.totalSales, 'USD').toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-3.5 px-6 tabular-nums text-sm">
                        <span className={totals.totalNetIncome >= 0 ? 'text-[#34C759] font-medium' : 'text-[#FF3B30] font-medium'}>
                          {currencySymbol}{convert(totals.totalNetIncome, 'USD').toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="text-right py-3.5 px-6 tabular-nums text-sm">
                        <span className={totals.profitRate >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}>
                          {totals.profitRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right py-3.5 px-6 tabular-nums text-sm text-[#1D1D1F]">{totals.skuCount}</td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-[#6E6E73]">
                      暂无数据，请先在「数据导入」页上传报表
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