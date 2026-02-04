const STORAGE_KEYS = {
  PRODUCTS: 'pos_products',
  ORDERS: 'pos_orders',
  CATEGORIES: 'pos_categories',
  STORE: 'pos_store',
  PIN: 'pos_pin',
};

const DEFAULT_CATEGORIES = ['手作', '飾品', '文具', '織品', '陶藝', '其他'];

export function getCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [...DEFAULT_CATEGORIES];
}

export function saveCategories(categories) {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
}

const defaultProducts = [
  { id: 1, name: '手繪明信片組', price: 120, category: '文具', description: '一組五張，可混搭', isActive: true, useStock: false, stock: 0 },
  { id: 2, name: '陶製小皿', price: 380, category: '陶藝', description: '手捏陶，每件略有不同', isActive: true, useStock: false, stock: 0 },
  { id: 3, name: '編織杯墊', price: 150, category: '織品', description: '棉線手編', isActive: true, useStock: false, stock: 0 },
  { id: 4, name: '耳環・霧金', price: 280, category: '飾品', description: '黃銅鍍霧金', isActive: true, useStock: false, stock: 0 },
  { id: 5, name: '手工皂', price: 200, category: '手作', description: '天然精油', isActive: true, useStock: false, stock: 0 },
  { id: 6, name: '帆布托特包', price: 650, category: '織品', description: '單色可選', isActive: true, useStock: false, stock: 0 },
];

export function getProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return defaultProducts;
}

export function saveProducts(products) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

export function getOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

export function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}

const PAYMENT_IDS = ['line', 'cash', 'card'];

export function addOrder(order) {
  const orders = getOrders();
  const paymentMethod = PAYMENT_IDS.includes(order.paymentMethod) ? order.paymentMethod : 'cash';
  const newOrder = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    items: order.items,
    subtotal: order.subtotal != null ? order.subtotal : order.total,
    discount: order.discount || null,
    total: order.total,
    note: order.note || '',
    paymentMethod,
    createdAt: new Date().toISOString(),
  };
  orders.unshift(newOrder);
  saveOrders(orders);
  return newOrder;
}

export function updateOrder(orderId, updates) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  const next = [...orders];
  const allowed = ['note', 'total', 'subtotal', 'discount', 'paymentMethod', 'items'];
  const patch = {};
  allowed.forEach((k) => { if (updates[k] !== undefined) patch[k] = updates[k]; });
  next[idx] = { ...next[idx], ...patch };
  saveOrders(next);
  return next[idx];
}

export function deleteOrder(orderId) {
  const orders = getOrders().filter((o) => o.id !== orderId);
  saveOrders(orders);
  return true;
}

// 店鋪設定
const DEFAULT_STORE = { name: '', phone: '', address: '', taxId: '', pinDisabled: false };

export function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORE);
    if (raw) return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_STORE };
}

export function saveStore(store) {
  localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify({ ...DEFAULT_STORE, ...store }));
}

// 後台 PIN（存雜湊較安全，此處簡化存明文，僅防誤觸）
const PIN_KEY = STORAGE_KEYS.PIN;
const PIN_SESSION_KEY = 'pos_admin_unlock_until';

export function hasPin() {
  const p = localStorage.getItem(PIN_KEY);
  return p != null && String(p).length >= 4;
}

export function setPin(pin) {
  const p = String(pin).trim();
  if (p.length >= 4) localStorage.setItem(PIN_KEY, p);
}

export function checkPin(input) {
  const saved = localStorage.getItem(PIN_KEY);
  return saved != null && String(input).trim() === saved;
}

export function setUnlockSession(minutes = 30) {
  const until = Date.now() + minutes * 60 * 1000;
  try { sessionStorage.setItem(PIN_SESSION_KEY, String(until)); } catch (_) {}
}

export function isUnlocked() {
  try {
    const until = sessionStorage.getItem(PIN_SESSION_KEY);
    return until != null && Date.now() < Number(until);
  } catch (_) {}
  return false;
}

export function clearUnlockSession() {
  try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch (_) {}
}

// 庫存扣減
export function decrementProductStock(productId, qty) {
  const products = getProducts();
  const next = products.map((p) => {
    if (p.id !== productId || !p.useStock || typeof p.stock !== 'number') return p;
    return { ...p, stock: Math.max(0, p.stock - qty) };
  });
  saveProducts(next);
  return next;
}

// 匯出所有資料（備份）
export function exportAllData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    products: getProducts(),
    orders: getOrders(),
    categories: getCategories(),
    store: getStore(),
  };
}

// 匯入並覆蓋（還原）
export function importAllData(data) {
  if (data.products && Array.isArray(data.products)) saveProducts(data.products);
  if (data.orders && Array.isArray(data.orders)) saveOrders(data.orders);
  if (data.categories && Array.isArray(data.categories)) saveCategories(data.categories);
  if (data.store && typeof data.store === 'object') saveStore(data.store);
}
