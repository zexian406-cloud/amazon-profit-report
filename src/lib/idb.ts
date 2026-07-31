import { MonthlyData, SharedFee, StoreConfig, SKUProfitRow, HistoryMonth } from './types';

const DB_NAME = 'amazon_profit_db';
const DB_VERSION = 1;

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
    };
    request.onsuccess = () => resolve(request.result);
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