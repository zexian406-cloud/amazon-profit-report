'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useShops } from '@/hooks/use-shops';
import { getShopColor } from '@/lib/types';
import { Store, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { shops, addShop, removeShop, renameShop } = useShops();
  const [newShopName, setNewShopName] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newShopName.trim();
    if (!name) return;
    if (shops.some(s => s.name === name)) {
      alert('店铺名称已存在，请使用其他名称');
      return;
    }
    await addShop(name);
    setNewShopName('');
  };

  const handleRename = async (oldName: string) => {
    const newName = editingName.trim();
    if (!newName || newName === oldName) return;
    if (shops.some(s => s.name === newName)) {
      alert('店铺名称已存在，请使用其他名称');
      return;
    }
    await renameShop(oldName, newName);
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = async (name: string) => {
    if (shops.length <= 1) {
      alert('至少保留一个店铺');
      return;
    }
    await removeShop(name);
    setDeleteConfirm(null);
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
          <CardDescription>输入店铺名称后点击添加</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="输入店铺名称，如：四店"
              value={newShopName}
              onChange={(e) => setNewShopName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="max-w-xs"
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
          <CardDescription>共 {shops.length} 个店铺，点击店铺可编辑名称</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shops.map((shop, index) => (
              <div
                key={shop.name}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium text-sm"
                    style={{ backgroundColor: getShopColor(index) }}
                  >
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    {editingId === shop.name ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(shop.name)}
                          className="h-8 w-40"
                          autoFocus
                        />
                        <Button size="sm" variant="default" onClick={() => handleRename(shop.name)}>确定</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(''); }}>取消</Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{shop.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {shop.currency} · 订阅费 ${shop.subscriptionFee}/月
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingId(shop.name); setEditingName(shop.name); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Dialog open={deleteConfirm === shop.name} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(shop.name)}
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
                        <Button variant="destructive" onClick={() => handleDelete(shop.name)}>
                          确认删除
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}