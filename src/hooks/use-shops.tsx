'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Shop } from '@/lib/types';
import { getShops, addShop as addShopIdb, renameShop as renameShopIdb, deleteShop as deleteShopIdb } from '@/lib/idb';

const DEFAULT_SHOP_COLORS = [
  '#1e3a5f',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
];

interface ShopContextType {
  shops: Shop[];
  loading: boolean;
  addShop: (name: string) => Promise<void>;
  removeShop: (id: number) => Promise<void>;
  renameShop: (id: number, newName: string) => Promise<void>;
  getShopColor: (name: string) => string;
  getShopNames: () => string[];
}

const ShopContext = createContext<ShopContextType>({
  shops: [],
  loading: true,
  addShop: async () => {},
  removeShop: async () => {},
  renameShop: async () => {},
  getShopColor: () => '#1e3a5f',
  getShopNames: () => [],
});

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShops = useCallback(async () => {
    try {
      const list = await getShops();
      setShops(list);
    } catch (err) {
      console.error('加载店铺列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const addShop = useCallback(async (name: string) => {
    const newShop = await addShopIdb(name);
    setShops(prev => [...prev, newShop]);
  }, []);

  const removeShop = useCallback(async (id: number) => {
    await deleteShopIdb(id);
    setShops(prev => prev.filter((s) => s.id !== id));
  }, []);

  const renameShop = useCallback(async (id: number, newName: string) => {
    await renameShopIdb(id, newName);
    setShops(prev => prev.map((s) =>
      s.id === id ? { ...s, name: newName } : s
    ));
  }, []);

  const getShopColor = useCallback((name: string) => {
    const index = shops.findIndex((s) => s.name === name);
    return DEFAULT_SHOP_COLORS[index % DEFAULT_SHOP_COLORS.length];
  }, [shops]);

  const getShopNames = useCallback(() => {
    return shops.map((s) => s.name);
  }, [shops]);

  return (
    <ShopContext.Provider
      value={{ shops, loading, addShop, removeShop, renameShop, getShopColor, getShopNames }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShops() {
  return useContext(ShopContext);
}