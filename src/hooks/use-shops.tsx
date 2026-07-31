'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { StoreConfig } from '@/lib/types';
import { getStoreConfigs, saveStoreConfigs } from '@/lib/idb';

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
  shops: StoreConfig[];
  loading: boolean;
  addShop: (name: string) => Promise<void>;
  removeShop: (name: string) => Promise<void>;
  renameShop: (oldName: string, newName: string) => Promise<void>;
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
  const [shops, setShops] = useState<StoreConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShops = useCallback(async () => {
    try {
      const configs = await getStoreConfigs();
      setShops(configs);
    } catch (err) {
      console.error('加载店铺配置失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const addShop = useCallback(async (name: string) => {
    const newShop: StoreConfig = {
      id: Date.now(),
      name,
      currency: 'USD',
      subscriptionFee: 39.99,
      otherSharedFees: 0,
    };
    const updated = [...shops, newShop];
    await saveStoreConfigs(updated);
    setShops(updated);
  }, [shops]);

  const removeShop = useCallback(async (name: string) => {
    const updated = shops.filter((s) => s.name !== name);
    await saveStoreConfigs(updated);
    setShops(updated);
  }, [shops]);

  const renameShop = useCallback(async (oldName: string, newName: string) => {
    const updated = shops.map((s) =>
      s.name === oldName ? { ...s, name: newName } : s
    );
    await saveStoreConfigs(updated);
    setShops(updated);
  }, [shops]);

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