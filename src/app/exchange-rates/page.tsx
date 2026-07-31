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
import { useState as useToastState } from 'react';
import { CURRENCY_OPTIONS, type ExchangeRate } from '@/lib/types';
import { getExchangeRates, addExchangeRate, updateExchangeRate, deleteExchangeRate } from '@/lib/idb';

export default function ExchangeRatesPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formFrom, setFormFrom] = useState('USD');
  const [formTo, setFormTo] = useState('CNY');
  const [formRate, setFormRate] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadRates = async () => {
    setLoading(true);
    const data = await getExchangeRates();
    setRates(data);
    setLoading(false);
  };

  useEffect(() => { loadRates(); }, []);

  const resetForm = () => {
    setFormFrom('USD');
    setFormTo('CNY');
    setFormRate('');
    setEditingRate(null);
  };

  const showToast = (msg: string, isError = false) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSave = async () => {
    if (!formRate || parseFloat(formRate) <= 0) {
      showToast('请输入有效的汇率值', true);
      return;
    }
    if (formFrom === formTo) {
      showToast('源货币和目标货币不能相同', true);
      return;
    }
    try {
      if (editingRate) {
        await updateExchangeRate(editingRate.id!, {
          fromCurrency: formFrom,
          toCurrency: formTo,
          rate: parseFloat(formRate),
          updatedAt: new Date().toISOString(),
        });
        showToast('汇率已更新');
      } else {
        await addExchangeRate({
          fromCurrency: formFrom,
          toCurrency: formTo,
          rate: parseFloat(formRate),
          updatedAt: new Date().toISOString(),
        });
        showToast('汇率已添加');
      }
      setDialogOpen(false);
      resetForm();
      await loadRates();
    } catch (e: any) {
      showToast(e.message || '保存失败', true);
    }
  };

  const handleEdit = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setFormFrom(rate.fromCurrency);
    setFormTo(rate.toCurrency);
    setFormRate(String(rate.rate));
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该汇率规则？')) return;
    await deleteExchangeRate(id);
    showToast('汇率已删除');
    await loadRates();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">汇率管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            配置各货币之间的汇率换算规则，用于利润表多币种显示
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRates}>
            <RefreshCw className="h-4 w-4 mr-1" /> 刷新
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> 新增汇率
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRate ? '编辑汇率' : '新增汇率规则'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>源货币</Label>
                    <Select value={formFrom} onValueChange={setFormFrom} disabled={!!editingRate}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label} ({c.value})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>目标货币</Label>
                    <Select value={formTo} onValueChange={setFormTo} disabled={!!editingRate}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label} ({c.value})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>汇率值 (1 {formFrom} = ? {formTo})</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="例如：7.24"
                    value={formRate}
                    onChange={e => setFormRate(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleSave}>
                  {editingRate ? '保存修改' : '添加汇率'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">汇率规则列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : rates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">暂无汇率规则</p>
              <p className="text-sm text-muted-foreground mt-1">点击「新增汇率」添加美元→人民币等汇率规则</p>
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
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(rate)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(rate.id!)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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