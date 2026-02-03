import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getProducts, saveProducts, getOrders, addOrder as saveOrder, updateOrder as updateOrderStorage, deleteOrder as deleteOrderStorage,
  getCategories, saveCategories, getStore, saveStore, hasPin, checkPin as checkPinStorage, setPin as setPinStorage,
  setUnlockSession, decrementProductStock,
} from '../lib/storage';

const StoreContext = createContext(null);
const PIN_SESSION_KEY = 'pos_admin_unlock_until';

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategoriesState] = useState([]);
  const [store, setStoreState] = useState(() => getStore());
  const [unlockUntil, setUnlockUntil] = useState(() => {
    try { const u = sessionStorage.getItem(PIN_SESSION_KEY); return u ? Number(u) : 0; } catch (_) { return 0; }
  });

  useEffect(() => {
    setProducts(getProducts());
    setOrders(getOrders());
    setCategoriesState(getCategories());
    setStoreState(getStore());
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

  const isUnlocked = unlockUntil > Date.now();
  const updateUnlock = useCallback(() => {
    try { setUnlockUntil(Number(sessionStorage.getItem(PIN_SESSION_KEY)) || 0); } catch (_) { setUnlockUntil(0); }
  }, []);

  const persistCategories = useCallback((next) => {
    setCategoriesState(next);
    saveCategories(next);
  }, []);

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
  }, []);

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

  const submitOrder = useCallback((items, total, note = '', paymentMethod = 'cash', discount = null) => {
    const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    const payload = { items: [...items], subtotal, discount, total, note, paymentMethod };
    const newOrder = saveOrder(payload);
    setOrders(getOrders());
    const prods = getProducts();
    items.forEach((item) => {
      const p = prods.find((x) => x.id === item.id);
      if (p && p.useStock && typeof p.stock === 'number' && item.qty > 0) decrementProductStock(p.id, item.qty);
    });
    setProducts(getProducts());
    return newOrder;
  }, []);

  const updateStore = useCallback((next) => {
    saveStore({ ...getStore(), ...next });
    setStoreState(getStore());
  }, []);

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
    try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch (_) {}
    setUnlockUntil(0);
  }, []);

  const refreshOrders = useCallback(() => {
    setOrders(getOrders());
  }, []);

  const refreshProducts = useCallback(() => {
    setProducts(getProducts());
  }, []);

  const updateOrder = useCallback((orderId, updates) => {
    const updated = updateOrderStorage(orderId, updates);
    if (updated) setOrders(getOrders());
    return updated;
  }, []);

  const deleteOrder = useCallback((orderId) => {
    deleteOrderStorage(orderId);
    setOrders(getOrders());
  }, []);

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
    addCategory,
    removeCategory,
    updateCategory,
    addProduct,
    updateProduct,
    toggleProductActive,
    deleteProduct,
    persistProducts,
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
