import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getProducts, saveProducts, getOrders, addOrder as saveOrder, updateOrder as updateOrderStorage, deleteOrder as deleteOrderStorage,
  getCategories, saveCategories, getStore, saveStore, hasPin, checkPin as checkPinStorage, setPin as setPinStorage,
  setUnlockSession, decrementProductStock, importAllData,
} from '../lib/storage';
import { fetchStoreData, scheduleUpload, subscribeToStore, isSyncEnabled, uploadNow } from '../lib/syncSupabase';
import useOnlineStatus from '../hooks/useOnlineStatus';

function getCurrentDataForSync() {
  return {
    products: getProducts(),
    orders: getOrders(),
    categories: getCategories(),
    store: getStore(),
  };
}

export const StoreContext = createContext(null);
const PIN_SESSION_KEY = 'pos_admin_unlock_until';

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(() => getProducts());
  const [orders, setOrders] = useState(() => getOrders());
  const [categories, setCategoriesState] = useState(() => getCategories());
  const [store, setStoreState] = useState(() => getStore());
  const [isSyncing, setIsSyncing] = useState(false);
  const { isOnline, hasPendingSync, lastSyncAt, markPending, markSynced } = useOnlineStatus();
  const [unlockUntil, setUnlockUntil] = useState(() => {
    try { const u = sessionStorage.getItem(PIN_SESSION_KEY); return u ? Number(u) : 0; } catch { return 0; }
  });

  const triggerSync = useCallback(() => {
    if (!isSyncEnabled()) return;
    if (!navigator.onLine) { markPending(); return; }
    scheduleUpload(getCurrentDataForSync, {
      onUploadStart: () => setIsSyncing(true),
      onUploadEnd: (ok) => { setIsSyncing(false); if (ok) markSynced(); else markPending(); },
    });
  }, [markPending, markSynced]);

  // 上線時自動同步待上傳的資料
  useEffect(() => {
    if (!isOnline || !hasPendingSync || !isSyncEnabled()) return;
    setIsSyncing(true);
    uploadNow(getCurrentDataForSync).then((ok) => {
      setIsSyncing(false);
      if (ok) markSynced();
    });
  }, [isOnline, hasPendingSync, markSynced]);

  // 若有設定 Supabase 則從雲端覆蓋並訂閱即時更新
  useEffect(() => {
    if (!isSyncEnabled()) return;

    const unsub = subscribeToStore((remote) => {
      importAllData(remote);
      setProducts(getProducts());
      setOrders(getOrders());
      setCategoriesState(getCategories());
      setStoreState(getStore());
    });

    (async () => {
      const data = await fetchStoreData();
      if (data && (data.products?.length > 0 || data.orders?.length > 0 || data.categories?.length > 0)) {
        importAllData(data);
        setProducts(getProducts());
        setOrders(getOrders());
        setCategoriesState(getCategories());
        setStoreState(getStore());
      }
    })();

    return () => unsub();
  }, []);

  useEffect(() => {
    const keys = ['pos_products', 'pos_orders', 'pos_categories', 'pos_store'];
    const handler = (e) => {
      if (!e.key || !keys.includes(e.key)) return;
      if (e.key === 'pos_products') setProducts(getProducts());
      if (e.key === 'pos_orders') setOrders(getOrders());
      if (e.key === 'pos_categories') setCategoriesState(getCategories());
      if (e.key === 'pos_store') setStoreState(getStore());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (unlockUntil <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [unlockUntil]);
  const isUnlocked = unlockUntil > now;
  const updateUnlock = useCallback(() => {
    try { setUnlockUntil(Number(sessionStorage.getItem(PIN_SESSION_KEY)) || 0); } catch { setUnlockUntil(0); }
    setNow(Date.now());
  }, []);

  const persistCategories = useCallback((next) => {
    setCategoriesState(next);
    saveCategories(next);
    triggerSync();
  }, [triggerSync]);

  const addCategory = useCallback((name) => {
    const trimmed = String(name).trim();
    if (!trimmed) return;
    const current = getCategories();
    if (current.includes(trimmed)) return;
    persistCategories([...current, trimmed]);
  }, [persistCategories]);

  const removeCategory = useCallback((name) => {
    const current = getCategories();
    persistCategories(current.filter((c) => c !== name));
  }, [persistCategories]);

  const updateCategory = useCallback((oldName, newName) => {
    const trimmed = String(newName).trim();
    if (!trimmed || trimmed === oldName) return;
    const current = getCategories();
    const idx = current.indexOf(oldName);
    if (idx === -1) return;
    const next = [...current];
    next[idx] = trimmed;
    persistCategories(next);
    const nextProducts = getProducts().map((p) => (p.category === oldName ? { ...p, category: trimmed } : p));
    saveProducts(nextProducts);
    setProducts(nextProducts);
  }, [persistCategories]);

  const persistProducts = useCallback((nextProducts) => {
    setProducts(nextProducts);
    saveProducts(nextProducts);
    triggerSync();
  }, [triggerSync]);

  const addProduct = useCallback((product) => {
    const current = getProducts();
    const id = Math.max(0, ...current.map((p) => p.id)) + 1;
    const newProduct = { ...product, id, isActive: product.isActive !== false };
    persistProducts([...current, newProduct]);
    return newProduct;
  }, [persistProducts]);

  const updateProduct = useCallback((id, updates) => {
    const current = getProducts();
    persistProducts(
      current.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setProducts(getProducts());
  }, [persistProducts]);

  const toggleProductActive = useCallback((id) => {
    const current = getProducts();
    persistProducts(
      current.map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive } : p
      )
    );
    setProducts(getProducts());
  }, [persistProducts]);

  const deleteProduct = useCallback((id) => {
    const current = getProducts();
    persistProducts(current.filter((p) => p.id !== id));
    setProducts(getProducts());
  }, [persistProducts]);

  const activeProducts = products.filter((p) => p.isActive);

  const submitOrder = useCallback((items, total, note = '', paymentMethod = 'cash', cashInfo = null) => {
    const payload = { items: [...items], total, note, paymentMethod };
    if (cashInfo) { payload.cashReceived = cashInfo.cashReceived; payload.changeAmount = cashInfo.changeAmount; }
    const newOrder = saveOrder(payload);
    setOrders(getOrders());
    const prods = getProducts();
    items.forEach((item) => {
      const p = prods.find((x) => x.id === item.id);
      if (p && p.useStock && typeof p.stock === 'number' && item.qty > 0) decrementProductStock(p.id, item.qty);
    });
    setProducts(getProducts());
    triggerSync();
    return newOrder;
  }, [triggerSync]);

  const updateStore = useCallback((next) => {
    saveStore({ ...getStore(), ...next });
    setStoreState(getStore());
    triggerSync();
  }, [triggerSync]);

  const refreshStore = useCallback(() => {
    setStoreState(getStore());
  }, []);

  const adminPin = useCallback((input) => hasPin() && checkPinStorage(input), []);
  const adminSetPin = useCallback((pin) => {
    setPinStorage(pin);
  }, []);
  const adminUnlock = useCallback((minutes = 30) => {
    setUnlockSession(minutes);
    setUnlockUntil(Date.now() + minutes * 60 * 1000);
  }, []);
  const adminLock = useCallback(() => {
    try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch { /* empty */ }
    setUnlockUntil(0);
  }, []);

  const refreshOrders = useCallback(() => {
    setOrders(getOrders());
  }, []);

  const refreshProducts = useCallback(() => {
    setProducts(getProducts());
  }, []);

  const syncNow = useCallback(() => {
    triggerSync();
  }, [triggerSync]);

  const manualSync = useCallback(async () => {
    if (!isSyncEnabled()) return false;
    setIsSyncing(true);
    const ok = await uploadNow(getCurrentDataForSync);
    setIsSyncing(false);
    if (ok) markSynced();
    return ok;
  }, [markSynced]);

  const updateOrder = useCallback((orderId, updates) => {
    const updated = updateOrderStorage(orderId, updates);
    if (updated) setOrders(getOrders());
    triggerSync();
    return updated;
  }, [triggerSync]);

  const deleteOrder = useCallback((orderId) => {
    deleteOrderStorage(orderId);
    setOrders(getOrders());
    triggerSync();
  }, [triggerSync]);

  const voidOrder = useCallback((orderId, reason = '') => {
    const updated = updateOrderStorage(orderId, {
      voided: true,
      voidedAt: new Date().toISOString(),
      voidReason: String(reason || '').trim(),
    });
    if (updated) setOrders(getOrders());
    triggerSync();
    return updated;
  }, [triggerSync]);

  const value = {
    products,
    activeProducts,
    orders,
    categories,
    store,
    updateStore,
    refreshStore,
    isAdminUnlocked: isUnlocked,
    adminHasPin: hasPin(),
    adminCheckPin: adminPin,
    adminSetPin,
    adminUnlock,
    adminLock,
    updateUnlock,
    submitOrder,
    refreshOrders,
    refreshProducts,
    updateOrder,
    deleteOrder,
    voidOrder,
    addCategory,
    removeCategory,
    updateCategory,
    addProduct,
    updateProduct,
    toggleProductActive,
    deleteProduct,
    persistProducts,
    syncNow,
    manualSync,
    isSyncEnabled: isSyncEnabled(),
    isSyncing,
    isOnline,
    hasPendingSync,
    lastSyncAt,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
