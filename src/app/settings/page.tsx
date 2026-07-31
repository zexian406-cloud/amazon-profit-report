'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { useShops } from '@/hooks/use-shops';
import { getShopColor, CURRENCY_OPTIONS, type ShippingProvider } from '@/lib/types';
import { getShippingProviders, addShippingProvider, updateShippingProviderName, deleteShippingProvider } from '@/lib/idb';
import { Store, Plus, Pencil, Trash2, AlertTriangle, DollarSign, User, Package } from 'lucide-react';

export default function SettingsPage() {
  const { shops, addShop, removeShop, renameShop, updateShop } = useShops();
  const [newShopName, setNewShopName] = useState('');
  const [newShopCurrency, setNewShopCurrency] = useState('USD');
  const [newShopManager, setNewShopManager] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // 海外仓费用类型管理
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [newProviderName, setNewProviderName] = useState('');
  const [editingProviderId, setEditingProviderId] = useState<number | null>(null);
  const [editingProviderName, setEditingProviderName] = useState('');
  const [deleteProviderConfirm, setDeleteProviderConfirm] = useState<number | null>(null);

  useEffect(() => {
    getShippingProviders().then(setProviders);
  }, []);

  const handleAddProvider = async () => {
    const name = newProviderName.trim();
    if (!name) return;
    if (providers.some(p => p.name === name)) {
      alert('海外仓名称已存在');
      return;
    }
    await addShippingProvider(name);
    setProviders(await getShippingProviders());
    setNewProviderName('');
  };

  const handleRenameProvider = async (id: number) => {
    const name = editingProviderName.trim();
    if (!name) return;
    await updateShippingProviderName(id, name);
    setProviders(await getShippingProviders());
    setEditingProviderId(null);
    setEditingProviderName('');
  };

  const handleDeleteProvider = async (id: number) => {
    await deleteShippingProvider(id);
    setProviders(await getShippingProviders());
    setDeleteProviderConfirm(null);
  };

  const handleAdd = async () => {
    const name = newShopName.trim();
    if (!name) return;
    if (shops.some(s => s.name === name)) {
      alert('店铺名称已存在，请使用其他名称');
      return;
    }
    await addShop(name, newShopCurrency, newShopManager);
    setNewShopName('');
    setNewShopCurrency('USD');
    setNewShopManager('');
  };

  const handleRename = async (id: number) => {
    const newName = editingName.trim();
    const oldName = shops.find(s => s.id === id)?.name;
    if (!newName || !oldName || newName === oldName) return;
    if (shops.some(s => s.name === newName)) {
      alert('店铺名称已存在，请使用其他名称');
      return;
    }
    await renameShop(id, newName);
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = async (id: number) => {
    if (shops.length <= 1) {
      alert('至少保留一个店铺');
      return;
    }
    await removeShop(id);
    setDeleteConfirm(null);
  };

  const handleCurrencyChange = async (shopId: number, currency: string) => {
    const shop = shops.find(s => s.id === shopId);
    if (shop) {
      await updateShop(shopId, { ...shop, currency } as any);
    }
  };

  const handleManagerChange = async (shopId: number, defaultManager: string) => {
    const shop = shops.find(s => s.id === shopId);
    if (shop) {
      await updateShop(shopId, { ...shop, defaultManager } as any);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">店铺管理</h1>
          <p className="text-muted-foreground mt-1">管理你的亚马逊店铺，支持自定义添加、重命名和删除</p>
        </div>
      </div>

      {/* 添加新店铺 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">添加新店铺</CardTitle>
          <CardDescription>输入店铺名称、选择货币单位和默认负责人</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="店铺名称，如：四店"
              value={newShopName}
              onChange={(e) => setNewShopName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="max-w-xs"
            />
            <Select value={newShopCurrency} onValueChange={setNewShopCurrency}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="货币单位" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="默认负责人（可选）"
              value={newShopManager}
              onChange={(e) => setNewShopManager(e.target.value)}
              className="max-w-[180px]"
            />
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 店铺列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">当前店铺列表</CardTitle>
          <CardDescription>共 {shops.length} 个店铺，可编辑名称、货币单位和默认负责人</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shops.map((shop) => (
              <div
                key={shop.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium text-sm"
                      style={{ backgroundColor: getShopColor(shop.name) }}
                    >
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      {editingId === shop.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename(shop.id)}
                            className="h-8 w-40"
                            autoFocus
                          />
                          <Button size="sm" variant="default" onClick={() => handleRename(shop.id)}>确定</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(''); }}>取消</Button>
                        </div>
                      ) : (
                        <span className="font-medium">{shop.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingId(shop.id); setEditingName(shop.name); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Dialog open={deleteConfirm === shop.id} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(shop.id)}
                          disabled={shops.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            确认删除店铺
                          </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          删除「{shop.name}」将同时清除该店铺的所有导入数据。此操作不可撤销，请确认。
                        </p>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">取消</Button>
                          </DialogClose>
                          <Button variant="destructive" onClick={() => handleDelete(shop.id)}>
                            确认删除
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* 货币单位和默认负责人 */}
                <div className="flex items-center gap-6 pl-[52px]">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">货币：</span>
                    <Select
                      value={shop.currency || 'USD'}
                      onValueChange={(v) => handleCurrencyChange(shop.id, v)}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">负责人：</span>
                    <Input
                      defaultValue={shop.defaultManager || ''}
                      placeholder="默认负责人"
                      className="h-8 w-[160px]"
                      onBlur={(e) => handleManagerChange(shop.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleManagerChange(shop.id, (e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 海外仓费用类型管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            海外仓费用类型管理
          </CardTitle>
          <CardDescription>
            管理利润表中的海外仓尾程运费列。默认包含乐歌、京东。新增合作仓库后在此添加，利润表会自动生成对应列。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {providers.map((provider) => (
              <div key={provider.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  {editingProviderId === provider.id ? (
                    <Input
                      value={editingProviderName}
                      onChange={(e) => setEditingProviderName(e.target.value)}
                      className="h-8 w-[200px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameProvider(provider.id!);
                        if (e.key === 'Escape') { setEditingProviderId(null); }
                      }}
                    />
                  ) : (
                    <span className="font-medium">{provider.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingProviderId === provider.id ? (
                    <>
                      <Button size="sm" onClick={() => handleRenameProvider(provider.id!)}>保存</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingProviderId(null)}>取消</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingProviderId(provider.id ?? null);
                        setEditingProviderName(provider.name);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteProviderConfirm(provider.id ?? null)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                placeholder="新海外仓名称，如：万邑通"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddProvider();
                }}
              />
              <Button onClick={handleAddProvider} size="sm">添加</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 删除海外仓确认弹窗 */}
      <Dialog open={deleteProviderConfirm !== null} onOpenChange={(open) => !open && setDeleteProviderConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后，利润表中将不再显示该海外仓的尾程运费列。已导入的运费数据不受影响，但不会在利润表中展示。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteProviderConfirm !== null) {
                  handleDeleteProvider(deleteProviderConfirm!);
                }
              }}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}