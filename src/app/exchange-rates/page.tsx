'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { CURRENCY_OPTIONS, type ExchangeRate, type ExchangeRateOverride } from '@/lib/types';
import {
  getExchangeRates, addExchangeRate, updateExchangeRate, deleteExchangeRate,
  getExchangeRateOverrides, addExchangeRateOverride, updateExchangeRateOverride, deleteExchangeRateOverride,
} from '@/lib/idb';

export default function ExchangeRatesPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [overrides, setOverrides] = useState<ExchangeRateOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Default rate dialog
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [rateFormFrom, setRateFormFrom] = useState('USD');
  const [rateFormTo, setRateFormTo] = useState('CNY');
  const [rateFormValue, setRateFormValue] = useState('');

  // Monthly override dialog
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<ExchangeRateOverride | null>(null);
  const [overrideFormMonth, setOverrideFormMonth] = useState('');
  const [overrideFormFrom, setOverrideFormFrom] = useState('USD');
  const [overrideFormTo, setOverrideFormTo] = useState('CNY');
  const [overrideFormValue, setOverrideFormValue] = useState('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [r, o] = await Promise.all([getExchangeRates(), getExchangeRateOverrides()]);
    setRates(r);
    setOverrides(o.sort((a, b) => b.month.localeCompare(a.month)));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // === Default Rate Handlers ===
  const resetRateForm = () => {
    setRateFormFrom('USD');
    setRateFormTo('CNY');
    setRateFormValue('');
    setEditingRate(null);
  };

  const handleSaveRate = async () => {
    if (!rateFormValue || parseFloat(rateFormValue) <= 0) { showToast('请输入有效的汇率值'); return; }
    if (rateFormFrom === rateFormTo) { showToast('源货币和目标货币不能相同'); return; }
    try {
      if (editingRate) {
        await updateExchangeRate(editingRate.id!, {
          fromCurrency: rateFormFrom,
          toCurrency: rateFormTo,
          rate: parseFloat(rateFormValue),
          updatedAt: new Date().toISOString(),
        });
        showToast('默认汇率已更新');
      } else {
        await addExchangeRate({
          fromCurrency: rateFormFrom,
          toCurrency: rateFormTo,
          rate: parseFloat(rateFormValue),
          updatedAt: new Date().toISOString(),
        });
        showToast('默认汇率已添加');
      }
      setRateDialogOpen(false);
      resetRateForm();
      await loadData();
    } catch (e: any) {
      showToast(e.message || '保存失败');
    }
  };

  const handleEditRate = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setRateFormFrom(rate.fromCurrency);
    setRateFormTo(rate.toCurrency);
    setRateFormValue(String(rate.rate));
    setRateDialogOpen(true);
  };

  const handleDeleteRate = async (id: number) => {
    if (!confirm('确定删除该默认汇率规则？')) return;
    await deleteExchangeRate(id);
    showToast('默认汇率已删除');
    await loadData();
  };

  // === Monthly Override Handlers ===
  const resetOverrideForm = () => {
    setOverrideFormMonth('');
    setOverrideFormFrom('USD');
    setOverrideFormTo('CNY');
    setOverrideFormValue('');
    setEditingOverride(null);
  };

  const handleSaveOverride = async () => {
    if (!overrideFormMonth) { showToast('请选择月份'); return; }
    if (!overrideFormValue || parseFloat(overrideFormValue) <= 0) { showToast('请输入有效的汇率值'); return; }
    if (overrideFormFrom === overrideFormTo) { showToast('源货币和目标货币不能相同'); return; }
    try {
      if (editingOverride) {
        await updateExchangeRateOverride(editingOverride.id!, {
          month: overrideFormMonth,
          fromCurrency: overrideFormFrom,
          toCurrency: overrideFormTo,
          rate: parseFloat(overrideFormValue),
          updatedAt: new Date().toISOString(),
        });
        showToast('月度汇率已更新');
      } else {
        await addExchangeRateOverride({
          month: overrideFormMonth,
          fromCurrency: overrideFormFrom,
          toCurrency: overrideFormTo,
          rate: parseFloat(overrideFormValue),
          updatedAt: new Date().toISOString(),
        });
        showToast('月度汇率已添加');
      }
      setOverrideDialogOpen(false);
      resetOverrideForm();
      await loadData();
    } catch (e: any) {
      showToast(e.message || '保存失败');
    }
  };

  const handleEditOverride = (ov: ExchangeRateOverride) => {
    setEditingOverride(ov);
    setOverrideFormMonth(ov.month);
    setOverrideFormFrom(ov.fromCurrency);
    setOverrideFormTo(ov.toCurrency);
    setOverrideFormValue(String(ov.rate));
    setOverrideDialogOpen(true);
  };

  const handleDeleteOverride = async (id: number) => {
    if (!confirm('确定删除该月度汇率？')) return;
    await deleteExchangeRateOverride(id);
    showToast('月度汇率已删除');
    await loadData();
  };

  // Generate month options for the last 24 months
  const getMonthOptions = () => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return options;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">汇率管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            默认汇率作为兜底，月度汇率可针对特定月份单独设置
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-1" /> 刷新
        </Button>
      </div>

      {/* ===== 默认汇率 ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">默认汇率（兜底）</CardTitle>
          <Dialog open={rateDialogOpen} onOpenChange={(open) => { setRateDialogOpen(open); if (!open) resetRateForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> 新增默认汇率</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRate ? '编辑默认汇率' : '新增默认汇率'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>源货币</Label>
                    <Select value={rateFormFrom} onValueChange={setRateFormFrom} disabled={!!editingRate}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label} ({c.value})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>目标货币</Label>
                    <Select value={rateFormTo} onValueChange={setRateFormTo} disabled={!!editingRate}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label} ({c.value})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>汇率值 (1 {rateFormFrom} = ? {rateFormTo})</Label>
                  <Input type="number" step="0.0001" placeholder="例如：7.24" value={rateFormValue} onChange={e => setRateFormValue(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSaveRate}>{editingRate ? '保存修改' : '添加'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {rates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">暂无默认汇率</p>
              <p className="text-sm text-muted-foreground mt-1">点击上方按钮添加美元→人民币等汇率规则</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rates.map((rate) => (
                <div key={rate.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium text-lg">{rate.fromCurrency}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono font-medium text-lg">{rate.toCurrency}</span>
                    <span className="text-muted-foreground mx-2">=</span>
                    <span className="font-mono text-lg font-bold">{rate.rate}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditRate(rate)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteRate(rate.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 月度汇率 ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">月度汇率（按月份覆盖）</CardTitle>
          <Dialog open={overrideDialogOpen} onOpenChange={(open) => { setOverrideDialogOpen(open); if (!open) resetOverrideForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> 新增月度汇率</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingOverride ? '编辑月度汇率' : '新增月度汇率'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>选择月份</Label>
                  <Select value={overrideFormMonth} onValueChange={setOverrideFormMonth}>
                    <SelectTrigger><SelectValue placeholder="选择月份" /></SelectTrigger>
                    <SelectContent>
                      {getMonthOptions().map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>源货币</Label>
                    <Select value={overrideFormFrom} onValueChange={setOverrideFormFrom} disabled={!!editingOverride}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label} ({c.value})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>目标货币</Label>
                    <Select value={overrideFormTo} onValueChange={setOverrideFormTo} disabled={!!editingOverride}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label} ({c.value})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>汇率值 (1 {overrideFormFrom} = ? {overrideFormTo})</Label>
                  <Input type="number" step="0.0001" placeholder="例如：7.24" value={overrideFormValue} onChange={e => setOverrideFormValue(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSaveOverride}>{editingOverride ? '保存修改' : '添加'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">暂无月度汇率</p>
              <p className="text-sm text-muted-foreground mt-1">点击上方按钮为特定月份设置汇率</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overrides.map((ov) => (
                <div key={ov.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{ov.month}</span>
                    <span className="font-mono font-medium">{ov.fromCurrency}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono font-medium">{ov.toCurrency}</span>
                    <span className="text-muted-foreground mx-2">=</span>
                    <span className="font-mono font-bold">{ov.rate}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditOverride(ov)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteOverride(ov.id!)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-popover border rounded-lg px-4 py-3 shadow-lg text-sm">
          {toastMsg}
        </div>
      )}
    </div>
  );
}