import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getProducts, saveProducts, getOrders, addOrder as saveOrder, updateOrder as updateOrderStorage, deleteOrder as deleteOrderStorage,
  getCategories, saveCategories, getStore, saveStore, hasPin, checkPin as checkPinStorage, setPin as setPinStorage,
  setUnlockSession, decrementProductStock, importAllData,
} from '../lib/storage';
import {
  fetchStoreData,
  scheduleUpload,
  subscribeToStore,
  isSyncEnabled,
  uploadNow,
  isRemoteAheadOfCursor,
  setRemoteCursor,
  clearRemoteCursor,
  POLL_INTERVAL_MS,
} from '../lib/syncSupabase';
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
  const [syncError, setSyncError] = useState(null);
  const { isOnline, hasPendingSync, lastSyncAt, markPending, markSynced } = useOnlineStatus();
  const [unlockUntil, setUnlockUntil] = useState(() => {
    try { const u = sessionStorage.getItem(PIN_SESSION_KEY); return u ? Number(u) : 0; } catch { return 0; }
  });

  const triggerSync = useCallback(() => {
    if (!isSyncEnabled()) return;
    scheduleUpload(getCurrentDataForSync, {
      onUploadStart: () => setIsSyncing(true),
      onUploadEnd: (ok) => { setIsSyncing(false); if (ok) markSynced(); else markPending(); },
    });
  }, [markPending, markSynced]);

  // 有待同步時立即重試，並定時再試（先前只跑一次：上傳失敗後 iOS 會永遠卡在「待同步」）
  useEffect(() => {
    if (!hasPendingSync || !isSyncEnabled()) return undefined;
    let cancelled = false;
    const tryUpload = async () => {
      if (cancelled) return;
      setIsSyncing(true);
      const ok = await uploadNow(getCurrentDataForSync);
      if (!cancelled) {
        setIsSyncing(false);
        if (ok) markSynced();
      }
    };
    void tryUpload();
    const id = window.setInterval(() => { void tryUpload(); }, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasPendingSync, markSynced]);

  const refreshFromCloud = useCallback(async () => {
    if (!isSyncEnabled()) return;
    try {
      const data = await fetchStoreData();
      if (!data) return;
      const shouldApply = isRemoteAheadOfCursor(data);
      if (shouldApply) {
        const { skippedEmptyRemote } = importAllData(data);
        setProducts(getProducts());
        setOrders(getOrders());
        setCategoriesState(getCategories());
        setStoreState(getStore());
        if (skippedEmptyRemote) triggerSync();
        setSyncError(null);
      } else {
        const remoteEmpty = !data.products || data.products.length === 0;
        if (remoteEmpty && getProducts().length > 0) {
          triggerSync();
        }
      }
      if (data.updatedAt) setRemoteCursor(data.updatedAt);
    } catch (e) {
      setSyncError(e?.message || String(e));
    }
  }, [triggerSync]);

  /** iOS Safari：背景分頁會暫停 setInterval、Realtime WebSocket 也常斷線；切回前景須主動拉雲端並上傳 */
  const resumeSync = useCallback(() => {
    if (!isSyncEnabled()) return;
    void refreshFromCloud();
    void uploadNow(getCurrentDataForSync).then((ok) => {
      if (ok) markSynced();
    });
  }, [refreshFromCloud, markSynced]);

  useEffect(() => {
    if (!isSyncEnabled()) return undefined;
    let debounceTimer = null;
    const schedule = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        resumeSync();
      }, 400);
    };
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('pageshow', schedule);
    window.addEventListener('online', schedule);
    // iOS WKWebView：從背景回前景時，有時不觸發 visibilitychange，focus 較可靠
    window.addEventListener('focus', schedule);
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('pageshow', schedule);
      window.removeEventListener('online', schedule);
      window.removeEventListener('focus', schedule);
    };
  }, [resumeSync]);

  // Supabase：即時訂閱 + 初次拉取 + HTTP 輪詢備援（游標避免誤覆寫）
  useEffect(() => {
    if (!isSyncEnabled()) return undefined;

    let unsub = () => {};
    try {
      unsub = subscribeToStore((remote) => {
        const { skippedEmptyRemote } = importAllData(remote);
        setProducts(getProducts());
        setOrders(getOrders());
        setCategoriesState(getCategories());
        setStoreState(getStore());
        if (skippedEmptyRemote) triggerSync();
      });
    } catch { /* WebSocket subscription failed */ }

    refreshFromCloud();

    const pollId = window.setInterval(refreshFromCloud, POLL_INTERVAL_MS);
    return () => {
      unsub();
      window.clearInterval(pollId);
    };
  }, [refreshFromCloud, triggerSync]);

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
    setSyncError(null);
    try {
      await uploadNow(getCurrentDataForSync);
      await refreshFromCloud();
      markSynced();
      setIsSyncing(false);
      return true;
    } catch (e) {
      setSyncError(e?.message || String(e));
      setIsSyncing(false);
      return false;
    }
  }, [markSynced, refreshFromCloud]);

  /**
   * 強制重新拉取：先上傳本機資料，然後清除游標並直接把雲端資料套用到本機。
   * 解決「上傳後游標被設為最新時間，refreshFromCloud 認為不需要拉取」的問題。
   */
  const forceRePull = useCallback(async () => {
    if (!isSyncEnabled()) return false;
    setIsSyncing(true);
    setSyncError(null);
    try {
      // 1. 先上傳本機（合併訂單後推上雲端）
      await uploadNow(getCurrentDataForSync);
      // 2. 清游標，確保下一步一定會拉
      clearRemoteCursor();
      // 3. 直接從雲端抓資料並強制套用（不判斷游標）
      const data = await fetchStoreData();
      if (data) {
        importAllData(data);
        setProducts(getProducts());
        setOrders(getOrders());
        setCategoriesState(getCategories());
        setStoreState(getStore());
        if (data.updatedAt) setRemoteCursor(data.updatedAt);
        markSynced();
      }
      setIsSyncing(false);
      return true;
    } catch (e) {
      setSyncError(e?.message || String(e));
      setIsSyncing(false);
      return false;
    }
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
    forceRePull,
    isSyncEnabled: isSyncEnabled(),
    isSyncing,
    syncError,
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
