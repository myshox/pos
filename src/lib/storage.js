import { JULY_15_CARD_RECORDS, PAYMENT_LINK_RECORDS } from '../data/paymentLinkRecords.js';
import { CONSOLIDATED_STATEMENT_RECORDS } from '../data/consolidatedStatementRecords.js';

const STORAGE_KEYS = {
  PRODUCTS: 'pos_products',
  ORDERS: 'pos_orders',
  CATEGORIES: 'pos_categories',
  STORE: 'pos_store',
  PIN: 'pos_pin',
};

const PAYMENT_LINK_MIGRATION_KEY = 'pos_migration_payment_link_20260520_20260819';
const CONSOLIDATED_STATEMENT_MIGRATION_KEY = 'pos_migration_consolidated_statements_202602_202607_v1';
const IMPORTED_LABEL_REPAIR_KEY = 'pos_migration_imported_labels_20260819_v5';
const PRODUCT_CONFIG_BY_PRICE = {
  100: ['舊款吊飾', '其他', '/products/old-charm.jpg'],
  250: ['迷你手作飾品', '飾品', '/products/handmade-jewelry.jpg'],
  300: ['手作飾品', '飾品', '/products/handmade-jewelry.jpg'],
  500: ['手作禮盒', '手作', '/products/handmade-gift.jpg'],
  1000: ['設計師簽繪', '手作', '/products/designer-signed-art.jpg'],
  2000: ['藝術收藏品', '陶藝', '/products/ceramic-collectible.jpg'],
  2500: ['精選收藏品', '陶藝', '/products/ceramic-collectible.jpg'],
  3000: ['典藏作品', '陶藝', '/products/ceramic-collectible.jpg'],
  3500: ['限量典藏作品', '陶藝', '/products/ceramic-collectible.jpg'],
  5000: ['大型典藏作品', '陶藝', '/products/ceramic-collectible.jpg'],
  5100: ['客製藝術作品', '陶藝', '/products/ceramic-collectible.jpg'],
  6000: ['雙件典藏組', '陶藝', '/products/ceramic-collectible.jpg'],
  8000: ['高階典藏作品', '陶藝', '/products/ceramic-collectible.jpg'],
  9000: ['典藏套組', '陶藝', '/products/ceramic-collectible.jpg'],
  10000: ['頂級典藏作品', '陶藝', '/products/ceramic-collectible.jpg'],
};
const PAYMENT_LINK_PRODUCTS = Object.entries(PRODUCT_CONFIG_BY_PRICE).map(([rawPrice, [name, category, image]]) => ({
  price: Number(rawPrice),
  id: -Number(rawPrice),
  name,
  category,
  description: '訂單商品',
  image,
  isActive: true,
  useStock: false,
  stock: 0,
}));

function paymentMethodFromRecord(method) {
  return method === 'ApplePay' || method === 'Apple Pay' || method === '信用卡' ? 'card' : 'line';
}

function getStatementManualMappings() {
  const mappings = new Map();
  const groups = [
    { date: '2026-03-28', amount: 1000, limit: 7 },
    { date: '2026-03-23', amount: 100, limit: 7 },
    { date: '2026-07-15', amount: 100, limit: 7 },
  ];
  for (const { date, amount, limit } of groups) {
    CONSOLIDATED_STATEMENT_RECORDS
      .filter((record) => record.paidAt.startsWith(date) && record.amount === amount)
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
      .slice(0, limit)
      .forEach((record, index) => {
        mappings.set(`missing-${date}-${amount}-${index + 1}`, record);
      });
  }
  return mappings;
}

/** 匯入綜合對帳單中的唯一成功訂單，並將既有手動訂單對應到真實交易。 */
export function migrateConsolidatedStatementRecords() {
  try {
    if (localStorage.getItem(CONSOLIDATED_STATEMENT_MIGRATION_KEY) === 'done') return false;

    const productByPrice = new Map(PAYMENT_LINK_PRODUCTS.map((product) => [product.price, product]));
    const products = getProducts().map((product) => {
      const replacement = productByPrice.get(Math.round(Number(product.price) || 0));
      return replacement && Number(product.id) === replacement.id
        ? { ...product, ...replacement }
        : { ...product, price: Math.round(Number(product.price) || 0) };
    });
    for (const product of PAYMENT_LINK_PRODUCTS) {
      if (!products.some((item) => item.id === product.id)) products.push(product);
    }

    const manualMappings = getStatementManualMappings();
    const mappedTransactionIds = new Set([...manualMappings.values()].map((record) => record.transactionId));
    const currentOrders = getOrders();
    const updatedOrders = currentOrders.map((order) => {
      const record = manualMappings.get(String(order.id));
      if (!record) return order;
      const product = productByPrice.get(record.amount);
      return {
        ...order,
        items: [{ ...product, qty: 1 }],
        subtotal: record.amount,
        total: record.amount,
        note: '',
        paymentMethod: paymentMethodFromRecord(record.method),
        createdAt: record.paidAt,
        externalTransactionId: record.transactionId,
      };
    });

    const representedTransactionIds = new Set(mappedTransactionIds);
    for (const order of updatedOrders) {
      const id = String(order.id);
      if (id.startsWith('payment-link-')) representedTransactionIds.add(id.slice('payment-link-'.length));
      if (id.startsWith('statement-')) representedTransactionIds.add(id.slice('statement-'.length));
      if (order.externalTransactionId) representedTransactionIds.add(String(order.externalTransactionId));
    }
    const newOrders = CONSOLIDATED_STATEMENT_RECORDS
      .filter((record) => !representedTransactionIds.has(record.transactionId))
      .map((record) => {
        const product = productByPrice.get(record.amount);
        return {
          id: `statement-${record.transactionId}`,
          items: [{ ...product, qty: 1 }],
          subtotal: record.amount,
          total: record.amount,
          note: '',
          paymentMethod: paymentMethodFromRecord(record.method),
          createdAt: record.paidAt,
          externalTransactionId: record.transactionId,
          voided: false,
        };
      });

    saveProducts(products);
    saveOrders([...newOrders, ...updatedOrders].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
    localStorage.setItem(CONSOLIDATED_STATEMENT_MIGRATION_KEY, 'done');
    return true;
  } catch {
    return false;
  }
}

/** 補登付款連結試算表中的成功交易；交易序號固定作為訂單 ID，避免跨裝置重複。 */
export function migratePaymentLinkRecords() {
  try {
    if (localStorage.getItem(PAYMENT_LINK_MIGRATION_KEY) === 'done') return false;

    const products = getProducts();
    for (const product of PAYMENT_LINK_PRODUCTS) {
      if (!products.some((item) => item.id === product.id)) products.push(product);
    }

    const orders = getOrders();
    const existingIds = new Set(orders.map((order) => String(order.id)));
    const importedOrders = PAYMENT_LINK_RECORDS
      .filter((record) => !existingIds.has(`payment-link-${record.transactionId}`))
      .map((record) => {
        const product = PAYMENT_LINK_PRODUCTS.find((item) => item.price === record.amount);
        return {
          id: `payment-link-${record.transactionId}`,
          items: [{ ...product, qty: 1 }],
          subtotal: record.amount,
          total: record.amount,
          note: '',
          paymentMethod: paymentMethodFromRecord(record.method),
          createdAt: record.paidAt,
          voided: false,
        };
      });

    saveProducts(products);
    saveOrders([...importedOrders, ...orders].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
    localStorage.setItem(PAYMENT_LINK_MIGRATION_KEY, 'done');
    return true;
  } catch {
    return false;
  }
}

/** 修正已匯入訂單的商品名稱、照片與整數價格，並清除所有既有備註。 */
export function repairImportedOrderLabels() {
  try {
    if (localStorage.getItem(IMPORTED_LABEL_REPAIR_KEY) === 'done') return false;

    const productByPrice = new Map(PAYMENT_LINK_PRODUCTS.map((product) => [product.price, product]));
    const products = getProducts().map((product) => {
      const price = Math.round(Number(product.price) || 0);
      const replacement = productByPrice.get(price);
      return replacement && Number(product.id) === -price
        ? { ...product, ...replacement }
        : { ...product, price };
    });
    for (const product of PAYMENT_LINK_PRODUCTS) {
      if (!products.some((item) => item.id === product.id)) products.push(product);
    }

    const recordsById = new Map(PAYMENT_LINK_RECORDS.map((record) => [
      `payment-link-${record.transactionId}`,
      record,
    ]));
    JULY_15_CARD_RECORDS.forEach((record, index) => {
      recordsById.set(`missing-2026-07-15-100-${index + 1}`, record);
    });
    const orders = getOrders().map((order) => {
      const id = String(order.id);
      if (!id.startsWith('missing-') && !id.startsWith('payment-link-') && !id.startsWith('statement-')) {
        return { ...order, note: '' };
      }
      const price = Math.round(Number(order.total) || 0);
      const product = productByPrice.get(price);
      if (!product) return order;
      const record = recordsById.get(id);
      return {
        ...order,
        items: [{ ...product, qty: 1 }],
        subtotal: price,
        total: price,
        note: '',
        paymentMethod: record ? paymentMethodFromRecord(record.method) : order.paymentMethod,
      };
    });

    saveProducts(products);
    saveOrders(orders);
    localStorage.setItem(IMPORTED_LABEL_REPAIR_KEY, 'done');
    return true;
  } catch {
    return false;
  }
}

const MISSING_ORDERS_MIGRATION_KEY = 'pos_migration_missing_orders_20260819';
const MIGRATION_PRODUCTS = [
  PAYMENT_LINK_PRODUCTS.find((product) => product.price === 1000),
  PAYMENT_LINK_PRODUCTS.find((product) => product.price === 100),
];

function makeMigratedOrder(id, product, createdAt) {
  return {
    id,
    items: [{ ...product, qty: 1 }],
    subtotal: product.price,
    total: product.price,
    note: '',
    paymentMethod: 'cash',
    createdAt,
    voided: false,
  };
}

/** 一次性補登指定的 21 筆訂單，並把既有商品價格四捨五入為整數。 */
export function migrateMissingOrdersAndIntegerPrices() {
  try {
    if (localStorage.getItem(MISSING_ORDERS_MIGRATION_KEY) === 'done') return false;

    const rawProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const currentProducts = rawProducts ? JSON.parse(rawProducts) : defaultProducts;
    const products = currentProducts.map((product) => ({
      ...product,
      price: Math.round(Number(product.price) || 0),
    }));
    for (const product of MIGRATION_PRODUCTS) {
      if (!products.some((item) => item.id === product.id)) products.push(product);
    }

    const rawOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
    const orders = rawOrders ? JSON.parse(rawOrders) : [];
    const batches = [
      { count: 7, product: MIGRATION_PRODUCTS[0], date: '2026-03-28' },
      { count: 7, product: MIGRATION_PRODUCTS[1], date: '2026-03-23' },
      { count: 7, product: MIGRATION_PRODUCTS[1], date: '2026-07-15' },
    ];
    const migratedOrders = batches.flatMap(({ count, product, date }) =>
      Array.from({ length: count }, (_, index) =>
        makeMigratedOrder(
          `missing-${date}-${product.price}-${index + 1}`,
          product,
          `${date}T12:${String(index).padStart(2, '0')}:00+08:00`,
        )
      )
    );
    const existingIds = new Set(orders.map((order) => order.id));
    const mergedOrders = [...migratedOrders.filter((order) => !existingIds.has(order.id)), ...orders]
      .map((order) => ({
        ...order,
        items: Array.isArray(order.items)
          ? order.items.map((item) => ({ ...item, price: Math.round(Number(item.price) || 0) }))
          : order.items,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    saveProducts(products);
    saveOrders(mergedOrders);
    localStorage.setItem(MISSING_ORDERS_MIGRATION_KEY, 'done');
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_CATEGORIES = ['手作', '飾品', '文具', '織品', '陶藝', '其他'];

export function getCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return [...DEFAULT_CATEGORIES];
}

export function saveCategories(categories) {
  try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories)); } catch { /* empty */ }
}

const defaultProducts = [
  { id: 1, name: '手繪明信片組', price: 120, category: '文具', description: '一組五張，可混搭', isActive: true, useStock: false, stock: 0 },
  { id: 2, name: '陶製小皿', price: 380, category: '陶藝', description: '手捏陶，每件略有不同', isActive: true, useStock: false, stock: 0 },
  { id: 3, name: '編織杯墊', price: 150, category: '織品', description: '棉線手編', isActive: true, useStock: false, stock: 0 },
  { id: 4, name: '耳環・霧金', price: 280, category: '飾品', description: '黃銅鍍霧金', isActive: true, useStock: false, stock: 0 },
  { id: 5, name: '手工皂', price: 200, category: '手作', description: '天然精油', isActive: true, useStock: false, stock: 0 },
  { id: 6, name: '帆布托特包', price: 650, category: '織品', description: '單色可選', isActive: true, useStock: false, stock: 0 },
];

const CHECKOUT_PRODUCT_MIGRATION_KEY = 'pos_checkout_products_20260819_v1';
const CHECKOUT_PRODUCTS = [
  { name: '原創明信片｜兔子與紅蘿蔔', price: 50, category: '明信片', image: '/showcase/postcard-1.jpg' },
  { name: '原創明信片｜園藝角色', price: 50, category: '明信片', image: '/showcase/postcard-2.jpg' },
  { name: '原創明信片｜大小角色', price: 50, category: '明信片', image: '/showcase/postcard-3.jpg' },
  { name: '原創明信片｜冰淇淋倉鼠', price: 50, category: '明信片', image: '/showcase/postcard-4.jpg' },
  { name: '原創貼紙 3 張', price: 100, category: '貼紙', image: '/showcase/stickers-postcards.jpg' },
  { name: '糖果袋鑰匙圈', price: 160, category: '吊飾', image: '/showcase/packaged-charms.jpg' },
  { name: '壓克力吊飾', price: 160, category: '吊飾', image: '/showcase/acrylic-charms.png' },
];

export function migrateCheckoutProducts() {
  try {
    if (localStorage.getItem(CHECKOUT_PRODUCT_MIGRATION_KEY) === 'done') return false;
    const current = getProducts();
    let nextId = Math.max(0, ...current.map((product) => Number(product.id) || 0)) + 1;
    const next = [...current];
    for (const seed of CHECKOUT_PRODUCTS) {
      const index = next.findIndex((product) => product.name === seed.name);
      const value = { ...seed, description: 'Studio Mogu 自有 IP 實體商品', isActive: true, useStock: false, stock: 0 };
      if (index >= 0) next[index] = { ...next[index], ...value };
      else next.push({ id: nextId++, ...value });
    }
    saveProducts(next);
    const categories = getCategories();
    const addedCategories = ['明信片', '貼紙', '吊飾'].filter((name) => !categories.includes(name));
    if (addedCategories.length) saveCategories([...categories, ...addedCategories]);
    localStorage.setItem(CHECKOUT_PRODUCT_MIGRATION_KEY, 'done');
    return true;
  } catch {
    return false;
  }
}

export function getProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return defaultProducts;
}

export function saveProducts(products) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

export function getOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return [];
}

const LOCAL_ORDER_DAYS = 7; // 本機只保留最近 N 天，全部訂單存雲端

function trimOrdersForLocal(orders) {
  if (!Array.isArray(orders)) return orders;
  const cutoff = Date.now() - LOCAL_ORDER_DAYS * 24 * 60 * 60 * 1000;
  return orders.filter((o) => {
    try { return new Date(o.createdAt).getTime() > cutoff; } catch { return true; }
  });
}

export function saveOrders(orders) {
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch {
    // iOS Safari localStorage 5MB 限制，只保留最近 7 天
    const trimmed = trimOrdersForLocal(orders);
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(trimmed));
    } catch {
      // 還是太大就只留 30 筆
      const minimal = Array.isArray(trimmed) ? trimmed.slice(0, 30) : trimmed;
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(minimal));
    }
  }
}

/** 取得所有訂單（含雲端），用於報表 */
export function getAllOrdersKey() { return STORAGE_KEYS.ORDERS; }

const PAYMENT_IDS = ['line', 'cash', 'card'];

export function addOrder(order) {
  const orders = getOrders();
  const paymentMethod = PAYMENT_IDS.includes(order.paymentMethod) ? order.paymentMethod : 'cash';
  const newOrder = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    items: order.items,
    subtotal: order.subtotal != null ? order.subtotal : order.total,
    total: order.total,
    note: '',
    paymentMethod,
    ...(order.cardProvider ? { cardProvider: order.cardProvider } : {}),
    ...(order.cashReceived != null ? { cashReceived: order.cashReceived, changeAmount: order.changeAmount } : {}),
    createdAt: new Date().toISOString(),
    voided: false,
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
  const allowed = ['note', 'total', 'subtotal', 'paymentMethod', 'cardProvider', 'items', 'voided', 'voidReason', 'voidedAt'];
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
const DEFAULT_STORE = { name: '', phone: '', address: '', taxId: '', companyEmail: '', supportEmail: '', returnPolicy: '', pinDisabled: false };

export function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORE);
    if (raw) return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch { /* empty */ }
  return { ...DEFAULT_STORE };
}

export function saveStore(store) {
  try { localStorage.setItem(STORAGE_KEYS.STORE, JSON.stringify({ ...DEFAULT_STORE, ...store })); } catch { /* empty */ }
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
  if (p.length >= 4) { try { localStorage.setItem(PIN_KEY, p); } catch { /* empty */ } }
}

export function checkPin(input) {
  const saved = localStorage.getItem(PIN_KEY);
  return saved != null && String(input).trim() === saved;
}

export function setUnlockSession(minutes = 30) {
  const until = Date.now() + minutes * 60 * 1000;
  try { sessionStorage.setItem(PIN_SESSION_KEY, String(until)); } catch { /* empty */ }
}

export function isUnlocked() {
  try {
    const until = sessionStorage.getItem(PIN_SESSION_KEY);
    return until != null && Date.now() < Number(until);
  } catch { /* empty */ }
  return false;
}

export function clearUnlockSession() {
  try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch { /* empty */ }
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

// 合併遠端訂單：以 id 為 key，遠端有而本地沒有的加入，兩邊都有的以較新的為準
function mergeOrders(localOrders, remoteOrders) {
  const map = new Map();
  for (const o of localOrders) map.set(o.id, o);
  for (const o of remoteOrders) {
    const existing = map.get(o.id);
    if (!existing) {
      map.set(o.id, o);
    } else {
      // 兩邊都有：以 voided/voidedAt 較新的為準（允許遠端作廢同步過來）
      if (o.voided && !existing.voided) map.set(o.id, o);
    }
  }
  // 依建立時間降序排列（最新在前）
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** 本機「有效」筆數：未寫入過 key 時沿用預設範本，避免被雲端空 [] 蓋掉 */
function getEffectiveLocalProductCount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw == null) return defaultProducts.length;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : defaultProducts.length;
  } catch {
    return defaultProducts.length;
  }
}

function getEffectiveLocalCategoryCount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (raw == null) return DEFAULT_CATEGORIES.length;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : DEFAULT_CATEGORIES.length;
  } catch {
    return DEFAULT_CATEGORIES.length;
  }
}

// 匯入並合併（同步用：訂單合併，其他覆蓋）
/** @returns {{ skippedEmptyRemote: boolean }} 若略過空雲端覆寫，應上傳本機以修復雲端 */
export function importAllData(data) {
  if (!data || typeof data !== 'object') return { skippedEmptyRemote: false };
  let skippedEmptyRemote = false;

  if (Array.isArray(data.products)) {
    if (data.products.length === 0 && getEffectiveLocalProductCount() > 0) {
      skippedEmptyRemote = true;
    } else {
      saveProducts(data.products);
    }
  }
  if (data.orders && Array.isArray(data.orders)) {
    const local = getOrders();
    const merged = mergeOrders(local, data.orders);
    saveOrders(merged);
  }
  if (Array.isArray(data.categories)) {
    if (data.categories.length === 0 && getEffectiveLocalCategoryCount() > 0) {
      skippedEmptyRemote = true;
    } else {
      saveCategories(data.categories);
    }
  }
  if (data.store && typeof data.store === 'object') saveStore(data.store);
  return { skippedEmptyRemote };
}

// 完整覆蓋匯入（備份還原用）
export function importAllDataOverwrite(data) {
  if (data.products && Array.isArray(data.products)) saveProducts(data.products);
  if (data.orders && Array.isArray(data.orders)) saveOrders(data.orders);
  if (data.categories && Array.isArray(data.categories)) saveCategories(data.categories);
  if (data.store && typeof data.store === 'object') saveStore(data.store);
}
