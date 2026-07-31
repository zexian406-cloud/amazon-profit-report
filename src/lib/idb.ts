import { MonthlyData, SharedFee, StoreConfig, SKUProfitRow, HistoryMonth, Shop, DEFAULT_SHOP_NAMES, ExchangeRate, ManagerMapping, ExchangeRateOverride, ShippingProvider } from './types';

const DB_NAME = 'amazon_profit_db';
const DB_VERSION = 6;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('monthlyData')) {
        db.createObjectStore('monthlyData', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('sharedFees')) {
        db.createObjectStore('sharedFees', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('storeConfigs')) {
        db.createObjectStore('storeConfigs', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('profitReports')) {
        db.createObjectStore('profitReports', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('shops')) {
        db.createObjectStore('shops', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('exchangeRates')) {
        db.createObjectStore('exchangeRates', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('managerMappings')) {
        db.createObjectStore('managerMappings', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('exchangeRateOverrides')) {
        db.createObjectStore('exchangeRateOverrides', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('shippingProviders')) {
        db.createObjectStore('shippingProviders', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ====== 月度汇率覆盖 (ExchangeRateOverrides) ======

export async function getExchangeRateOverrides(): Promise<ExchangeRateOverride[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRateOverrides', 'readonly');
    const store = tx.objectStore('exchangeRateOverrides');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addExchangeRateOverride(override: Omit<ExchangeRateOverride, 'id'>): Promise<ExchangeRateOverride> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRateOverrides', 'readwrite');
    const store = tx.objectStore('exchangeRateOverrides');
    const request = store.add(override);
    request.onsuccess = () => {
      const newId = request.result as number;
      resolve({ ...override, id: newId } as ExchangeRateOverride);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateExchangeRateOverride(id: number, override: Partial<ExchangeRateOverride>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRateOverrides', 'readwrite');
    const store = tx.objectStore('exchangeRateOverrides');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as ExchangeRateOverride;
      if (!existing) { reject(new Error('记录不存在')); return; }
      const updated = { ...existing, ...override };
      store.put(updated);
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteExchangeRateOverride(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRateOverrides', 'readwrite');
    const store = tx.objectStore('exchangeRateOverrides');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 保存月数据
export async function saveMonthlyData(data: MonthlyData): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('monthlyData', 'readwrite');
    const store = tx.objectStore('monthlyData');
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

// 获取所有月数据
export async function getAllMonthlyData(): Promise<MonthlyData[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('monthlyData', 'readonly');
    const store = tx.objectStore('monthlyData');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 按月份获取数据
export async function getMonthlyDataByMonth(month: string, storeName: string): Promise<MonthlyData | null> {
  const all = await getAllMonthlyData();
  return all.find(d => d.month === month && d.storeName === storeName) || null;
}

// 删除月数据
export async function deleteMonthlyData(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('monthlyData', 'readwrite');
    const store = tx.objectStore('monthlyData');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ====== 负责人映射 CRUD ======

export async function getManagerMappings(): Promise<ManagerMapping[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('managerMappings', 'readonly');
    const req = tx.objectStore('managerMappings').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveManagerMappings(mappings: Omit<ManagerMapping, 'id'>[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('managerMappings', 'readwrite');
    const store = tx.objectStore('managerMappings');
    // 清空旧数据
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      // 批量插入新数据
      for (const mapping of mappings) {
        store.add({ ...mapping });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateShop(id: number, updates: Partial<Pick<Shop, 'name' | 'currency' | 'defaultManager'>>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['shops', 'storeConfigs'], 'readwrite');
    const shopReq = tx.objectStore('shops').get(id);
    shopReq.onsuccess = () => {
      const shop = shopReq.result;
      if (shop) {
        Object.assign(shop, updates);
        tx.objectStore('shops').put(shop);
        // 同步更新 storeConfigs
        const configReq = tx.objectStore('storeConfigs').get(id);
        configReq.onsuccess = () => {
          const config = configReq.result;
          if (config) {
            Object.assign(config, updates);
            tx.objectStore('storeConfigs').put(config);
          }
        };
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// === Exchange Rates ===
export async function getExchangeRates(): Promise<ExchangeRate[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRates', 'readonly');
    const req = tx.objectStore('exchangeRates').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addExchangeRate(rate: Omit<ExchangeRate, 'id'>): Promise<ExchangeRate> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRates', 'readwrite');
    const store = tx.objectStore('exchangeRates');
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const maxId = allReq.result.reduce((max, r) => Math.max(max, r.id), 0);
      const newRate: ExchangeRate = { id: maxId + 1, ...rate };
      const req = store.add(newRate);
      req.onsuccess = () => resolve(newRate);
      req.onerror = () => reject(req.error);
    };
    allReq.onerror = () => reject(allReq.error);
  });
}

export async function updateExchangeRate(id: number, rate: Partial<ExchangeRate>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRates', 'readwrite');
    const store = tx.objectStore('exchangeRates');
    const req = store.get(id);
    req.onsuccess = () => {
      const existing = req.result;
      if (existing) {
        Object.assign(existing, rate);
        store.put(existing);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteExchangeRate(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exchangeRates', 'readwrite');
    tx.objectStore('exchangeRates').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 保存利润报表
export async function saveProfitReport(report: SKUProfitRow[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('profitReports', 'readwrite');
    const store = tx.objectStore('profitReports');
    // 先删除同月份同店铺的旧数据
    const getReq = store.getAll();
    getReq.onsuccess = () => {
      const existing = getReq.result as any[];
      existing.forEach((r: any) => {
        if (r[0]?.month === report[0]?.month && r[0]?.storeName === report[0]?.storeName) {
          store.delete(r.id);
        }
      });
      report.forEach((row) => store.add(row));
    };
  });
}

// 获取所有利润报表
export async function getAllProfitReports(): Promise<SKUProfitRow[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('profitReports', 'readonly');
    const store = tx.objectStore('profitReports');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 获取历史月份列表
export async function getHistoryMonths(): Promise<HistoryMonth[]> {
  const all = await getAllMonthlyData();
  const monthMap = new Map<string, { month: string; storeName: string; totalSales: number; totalNetIncome: number; profitMargin: number; skuCount: number }>();

  for (const data of all) {
    const key = `${data.month}-${data.storeName}`;
    const orders = data.transactions.filter(t => t.type === 'Order');
    const totalSales = orders.reduce((s, t) => s + t.totalAmount, 0);
    const refunds = data.transactions.filter(t => t.type === 'Refund');
    const totalRefunds = refunds.reduce((s, t) => s + Math.abs(t.totalAmount), 0);
    const netIncome = totalSales - totalRefunds;

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        month: data.month,
        storeName: data.storeName,
        totalSales: netIncome,
        totalNetIncome: netIncome,
        profitMargin: totalSales !== 0 ? (netIncome / totalSales) * 100 : 0,
        skuCount: new Set(data.transactions.map(t => t.sku)).size,
      });
    }
  }

  return Array.from(monthMap.values())
    .sort((a, b) => b.month.localeCompare(a.month));
}

// 保存共享费用
export async function saveSharedFees(fees: SharedFee[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sharedFees', 'readwrite');
    const store = tx.objectStore('sharedFees');
    fees.forEach((fee) => store.add(fee));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 获取共享费用
export async function getSharedFees(month: string, storeName: string): Promise<SharedFee[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sharedFees', 'readonly');
    const store = tx.objectStore('sharedFees');
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as SharedFee[];
      resolve(all.filter(f => f.month === month && f.storeName === storeName));
    };
    request.onerror = () => reject(request.error);
  });
}

// 店铺配置
export async function getStoreConfigs(): Promise<StoreConfig[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('storeConfigs', 'readonly');
    const store = tx.objectStore('storeConfigs');
    const request = store.getAll();
    request.onsuccess = () => {
      const result = request.result as StoreConfig[];
      if (result.length === 0) {
        resolve([
          { id: 1, name: '一店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
          { id: 2, name: '二店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
          { id: 3, name: '三店', currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 },
        ]);
      }
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveStoreConfigs(configs: StoreConfig[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('storeConfigs', 'readwrite');
    const store = tx.objectStore('storeConfigs');
    store.clear();
    configs.forEach((c) => store.add(c));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== 店铺动态管理 =====

export async function getShops(): Promise<Shop[]> {
  const db = await openDB();
  const shops = await new Promise<Shop[]>((resolve, reject) => {
    const tx = db.transaction('shops', 'readonly');
    const store = tx.objectStore('shops');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.id - b.id));
    req.onerror = () => reject(req.error);
  });
  // 首次使用自动初始化三个默认店铺
  if (shops.length === 0) {
    const defaults: Shop[] = [
      { id: 1, name: '一店', createdAt: new Date().toISOString(), currency: 'USD', defaultManager: '' },
      { id: 2, name: '二店', createdAt: new Date().toISOString(), currency: 'USD', defaultManager: '' },
      { id: 3, name: '三店', createdAt: new Date().toISOString(), currency: 'USD', defaultManager: '' },
    ];
    const writeTx = db.transaction(['shops', 'storeConfigs'], 'readwrite');
    const shopStore = writeTx.objectStore('shops');
    const configStore = writeTx.objectStore('storeConfigs');
    for (const shop of defaults) {
      shopStore.add(shop);
      configStore.add({ id: shop.id, name: shop.name, currency: 'USD', subscriptionFee: 39.99, otherSharedFees: 0 });
    }
    await new Promise<void>((resolve, reject) => {
      writeTx.oncomplete = () => resolve();
      writeTx.onerror = () => reject(writeTx.error);
    });
    return defaults;
  }
  return shops;
}

export async function addShop(name: string, currency = 'USD', defaultManager = ''): Promise<Shop> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shops', 'readwrite');
    const store = tx.objectStore('shops');
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const maxId = allReq.result.reduce((max, s) => Math.max(max, s.id), 0);
      const shop: Shop = { id: maxId + 1, name, createdAt: new Date().toISOString(), currency, defaultManager };
      const req = store.add(shop);
      req.onsuccess = () => {
        // 同步创建默认 StoreConfig
        const configTx = db.transaction('storeConfigs', 'readwrite');
        configTx.objectStore('storeConfigs').add({ id: shop.id, name, currency, subscriptionFee: 39.99, otherSharedFees: 0 });
        resolve(shop);
      };
      req.onerror = () => reject(req.error);
    };
    allReq.onerror = () => reject(allReq.error);
  });
}

export async function renameShop(id: number, name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['shops', 'storeConfigs'], 'readwrite');
    const shopStore = tx.objectStore('shops');
    const getReq = shopStore.get(id);
    getReq.onsuccess = () => {
      const shop = getReq.result;
      if (shop) {
        shop.name = name;
        shopStore.put(shop);
        // 同步更新 storeConfigs
        const configStore = tx.objectStore('storeConfigs');
        const configReq = configStore.get(id);
        configReq.onsuccess = () => {
          const config = configReq.result;
          if (config) {
            config.name = name;
            configStore.put(config);
          }
        };
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteShop(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['shops', 'storeConfigs'], 'readwrite');
    tx.objectStore('shops').delete(id);
    tx.objectStore('storeConfigs').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ====== Shipping Providers (海外仓费用类型) ======
export async function getShippingProviders(): Promise<ShippingProvider[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shippingProviders', 'readonly');
    const store = tx.objectStore('shippingProviders');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as ShippingProvider[]);
    req.onerror = () => reject(req.error);
  });
}

export async function addShippingProvider(name: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shippingProviders', 'readwrite');
    const store = tx.objectStore('shippingProviders');
    const req = store.add({ name, createdAt: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function updateShippingProviderName(id: number, name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shippingProviders', 'readwrite');
    const store = tx.objectStore('shippingProviders');
    const req = store.get(id);
    req.onsuccess = () => {
      const data = req.result as ShippingProvider;
      data.name = name;
      store.put(data);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteShippingProvider(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shippingProviders', 'readwrite');
    tx.objectStore('shippingProviders').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}