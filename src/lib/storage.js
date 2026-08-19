Exit code: 0
Wall time: 0.2 seconds
Output:
import { PAYMENT_LINK_RECORDS } from '../data/paymentLinkRecords';

const STORAGE_KEYS = {
  PRODUCTS: 'pos_products',
  ORDERS: 'pos_orders',
  CATEGORIES: 'pos_categories',
  STORE: 'pos_store',
  PIN: 'pos_pin',
};

const PAYMENT_LINK_MIGRATION_KEY = 'pos_migration_payment_link_20260520_20260819';
const PAYMENT_LINK_PRODUCTS = [100, 300, 500, 1000, 2000, 3000, 3500, 5100].map((price) => ({
  id: -price,
  name: price === 100 ? '绮鹃伕灏忕墿' : price === 1000 ? '瀹㈣＝鍟嗗搧' : `浜ゆ槗鍟嗗搧 NT$${price}`,
  price,
  category: '鍏朵粬',
  description: '浠樻閫ｇ祼瑁滅櫥鍟嗗搧',
  isActive: true,
  useStock: false,
  stock: 0,
}));

/** 瑁滅櫥浠樻閫ｇ祼瑭︾畻琛ㄤ腑鐨勬垚鍔熶氦鏄擄紱浜ゆ槗搴忚櫉鍥哄畾浣滅偤瑷傚柈 ID锛岄伩鍏嶈法瑁濈疆閲嶈銆?*/
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
        const isCard = record.method === 'ApplePay' || record.method === '淇＄敤鍗?;
        return {
          id: `payment-link-${record.transactionId}`,
          items: [{ ...product, qty: 1 }],
          subtotal: record.amount,
          total: record.amount,
          note: `瑁滅櫥浠樻閫ｇ祼锝?{record.method}锝?{record.customer}锝?{record.orderNo}`,
          paymentMethod: isCard ? 'card' : 'line',
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

const MISSING_ORDERS_MIGRATION_KEY = 'pos_migration_missing_orders_20260819';
const MIGRATION_PRODUCTS = [
  { id: -1000, name: '瀹㈣＝鍟嗗搧', price: 1000, category: '鍏朵粬', description: '瑁滅櫥瑷傚柈鐢ㄥ晢鍝?, isActive: true, useStock: false, stock: 0 },
  { id: -100, name: '绮鹃伕灏忕墿', price: 100, category: '鍏朵粬', description: '瑁滅櫥瑷傚柈鐢ㄥ晢鍝?, isActive: true, useStock: false, stock: 0 },
];

function makeMigratedOrder(id, product, createdAt) {
  return {
    id,
    items: [{ ...product, qty: 1 }],
    subtotal: product.price,
    total: product.price,
    note: '瑁滅櫥瑷傚柈',
    paymentMethod: 'cash',
    createdAt,
    voided: false,
  };
}

/** 涓€娆℃€ц鐧绘寚瀹氱殑 21 绛嗚▊鍠紝涓︽妸鏃㈡湁鍟嗗搧鍍规牸鍥涙崹浜斿叆鐐烘暣鏁搞€?*/
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

const DEFAULT_CATEGORIES = ['鎵嬩綔', '椋惧搧', '鏂囧叿', '绻斿搧', '闄惰棟', '鍏朵粬'];

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
  { id: 1, name: '鎵嬬躬鏄庝俊鐗囩祫', price: 120, category: '鏂囧叿', description: '涓€绲勪簲寮碉紝鍙贩鎼?, isActive: true, useStock: false, stock: 0 },
  { id: 2, name: '闄惰＝灏忕毧', price: 380, category: '闄惰棟', description: '鎵嬫崗闄讹紝姣忎欢鐣ユ湁涓嶅悓', isActive: true, useStock: false, stock: 0 },
  { id: 3, name: '绶ㄧ箶鏉', price: 150, category: '绻斿搧', description: '妫夌窔鎵嬬法', isActive: true, useStock: false, stock: 0 },
  { id: 4, name: '鑰崇挵銉婚湩閲?, price: 280, category: '椋惧搧', description: '榛冮妳閸嶉湩閲?, isActive: true, useStock: false, stock: 0 },
  { id: 5, name: '鎵嬪伐鐨?, price: 200, category: '鎵嬩綔', description: '澶╃劧绮炬补', isActive: true, useStock: false, stock: 0 },
  { id: 6, name: '甯嗗竷鎵樼壒鍖?, price: 650, category: '绻斿搧', description: '鍠壊鍙伕', isActive: true, useStock: false, stock: 0 },
];

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

const LOCAL_ORDER_DAYS = 7; // 鏈鍙繚鐣欐渶杩?N 澶╋紝鍏ㄩ儴瑷傚柈瀛橀洸绔?

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
    // iOS Safari localStorage 5MB 闄愬埗锛屽彧淇濈暀鏈€杩?7 澶?
    const trimmed = trimOrdersForLocal(orders);
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(trimmed));
    } catch {
      // 閭勬槸澶ぇ灏卞彧鐣?30 绛?
      const minimal = Array.isArray(trimmed) ? trimmed.slice(0, 30) : trimmed;
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(minimal));
    }
  }
}

/** 鍙栧緱鎵€鏈夎▊鍠紙鍚洸绔級锛岀敤鏂煎牨琛?*/
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
    note: order.note || '',
    paymentMethod,
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
  const allowed = ['note', 'total', 'subtotal', 'paymentMethod', 'items', 'voided', 'voidReason', 'voidedAt'];
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

// 搴楅嫪瑷畾
const DEFAULT_STORE = { name: '', phone: '', address: '', taxId: '', pinDisabled: false };

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

// 寰屽彴 PIN锛堝瓨闆滄箠杓冨畨鍏紝姝よ檿绨″寲瀛樻槑鏂囷紝鍍呴槻瑾よЦ锛?
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

// 搴瓨鎵ｆ笡
export function decrementProductStock(productId, qty) {
  const products = getProducts();
  const next = products.map((p) => {
    if (p.id !== productId || !p.useStock || typeof p.stock !== 'number') return p;
    return { ...p, stock: Math.max(0, p.stock - qty) };
  });
  saveProducts(next);
  return next;
}

// 鍖嚭鎵€鏈夎硣鏂欙紙鍌欎唤锛?
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

// 鍚堜降閬犵瑷傚柈锛氫互 id 鐐?key锛岄仩绔湁鑰屾湰鍦版矑鏈夌殑鍔犲叆锛屽叐閭婇兘鏈夌殑浠ヨ純鏂扮殑鐐烘簴
function mergeOrders(localOrders, remoteOrders) {
  const map = new Map();
  for (const o of localOrders) map.set(o.id, o);
  for (const o of remoteOrders) {
    const existing = map.get(o.id);
    if (!existing) {
      map.set(o.id, o);
    } else {
      // 鍏╅倞閮芥湁锛氫互 voided/voidedAt 杓冩柊鐨勭偤婧栵紙鍏佽ū閬犵浣滃虎鍚屾閬庝締锛?
      if (o.voided && !existing.voided) map.set(o.id, o);
    }
  }
  // 渚濆缓绔嬫檪闁撻檷搴忔帓鍒楋紙鏈€鏂板湪鍓嶏級
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** 鏈銆屾湁鏁堛€嶇瓎鏁革細鏈鍏ラ亷 key 鏅傛部鐢ㄩ爯瑷瘎鏈紝閬垮厤琚洸绔┖ [] 钃嬫帀 */
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

// 鍖叆涓﹀悎浣碉紙鍚屾鐢細瑷傚柈鍚堜降锛屽叾浠栬钃嬶級
/** @returns {{ skippedEmptyRemote: boolean }} 鑻ョ暐閬庣┖闆茬瑕嗗锛屾噳涓婂偝鏈浠ヤ慨寰╅洸绔?*/
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

// 瀹屾暣瑕嗚搵鍖叆锛堝倷浠介倓鍘熺敤锛?
export function importAllDataOverwrite(data) {
  if (data.products && Array.isArray(data.products)) saveProducts(data.products);
  if (data.orders && Array.isArray(data.orders)) saveOrders(data.orders);
  if (data.categories && Array.isArray(data.categories)) saveCategories(data.categories);
  if (data.store && typeof data.store === 'object') saveStore(data.store);
}

