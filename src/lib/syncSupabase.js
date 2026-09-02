/**
 * 多台裝置同步：使用 Supabase 雲端儲存 + Realtime
 * 設定 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、VITE_STORE_KEY 後啟用（建置時寫入），未設定則僅使用本機 localStorage
 */

import { createClient } from '@supabase/supabase-js';

const STORE_ID = 'default';
const PRODUCT_TABLE = 'pos_products';
const ORDER_TABLE = 'pos_orders';
const SETTINGS_TABLE = 'pos_settings';
/** 與雲端 store_data.updated_at 對齊，避免輪詢／即時重複套用或誤覆寫 */
const REMOTE_TS_KEY = 'pos_sync_remote_updated_at';
const PRODUCT_TOMBSTONES_KEY = 'pos_sync_product_tombstones';
const ORDER_TOMBSTONES_KEY = 'pos_sync_order_tombstones';

let client = null;
let uploadTimer = null;
let uploadQueue = Promise.resolve();
let pendingUploadScopes = new Set();
const UPLOAD_DEBOUNCE_MS = 300;

/** 輪詢拉取間隔（Realtime 在部分 WebView 不穩時補強） */
export const POLL_INTERVAL_MS = 30000;

/** 優先 Vite 建置變數，否則見 main.jsx 載入的 public/config.json → globalThis.__POS_SYNC_CONFIG__ */
function getSyncEnv(name) {
  const fromVite = import.meta.env[name];
  if (fromVite != null && String(fromVite).trim() !== '') return String(fromVite).trim();
  try {
    const cfg = typeof globalThis !== 'undefined' ? globalThis.__POS_SYNC_CONFIG__ : null;
    if (cfg && typeof cfg === 'object') {
      const short = name.startsWith('VITE_') ? name.slice(5) : name;
      const v = cfg[name] ?? cfg[short];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
  } catch {
    /* empty */
  }
  return '';
}

function getClient() {
  if (client !== null) return client;
  const url = getSyncEnv('VITE_SUPABASE_URL');
  const key = getSyncEnv('VITE_SUPABASE_ANON_KEY');
  const storeKey = getSyncEnv('VITE_STORE_KEY');
  if (!url || !key) return null;
  if (!storeKey) return null;
  client = createClient(url, key, {
    global: {
      headers: {
        'x-store-key': storeKey,
      },
    },
  });
  return client;
}

export function getRemoteCursor() {
  try {
    return localStorage.getItem(REMOTE_TS_KEY);
  } catch {
    return null;
  }
}

export function setRemoteCursor(iso) {
  if (!iso || typeof iso !== 'string') return;
  try {
    localStorage.setItem(REMOTE_TS_KEY, iso);
  } catch { /* localStorage may be unavailable */ }
}

function cursorTimeMs(iso) {
  if (!iso || typeof iso !== 'string') return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * 雲端是否比本機游標新（用於輪詢拉取）
 * 無游標或游標無效：僅在雲端有實質資料（含店鋪設定）時才套用，避免空雲端覆寫本機
 */
export function isRemoteAheadOfCursor(remote) {
  if (!remote?.updatedAt) return false;
  const remoteMs = cursorTimeMs(remote.updatedAt);
  if (!Number.isFinite(remoteMs)) return false;
  const last = getRemoteCursor();
  const storeKeys = remote.store && typeof remote.store === 'object' ? Object.keys(remote.store).length : 0;
  const hasPayload =
    (remote.products?.length > 0) ||
    (remote.orders?.length > 0) ||
    (remote.categories?.length > 0) ||
    storeKeys > 0;
  if (!last) return hasPayload;
  const lastMs = cursorTimeMs(last);
  // iOS 若 localStorage 內游標毀損，NaN 會讓同步永遠不拉取 — 改為依雲端是否有資料決定
  if (!Number.isFinite(lastMs)) return hasPayload;
  return remoteMs > lastMs;
}

export function isSyncEnabled() {
  return !!getClient();
}

function rowToEntity(row) {
  return {
    ...(row?.data && typeof row.data === 'object' ? row.data : {}),
    id: row.id,
    _syncUpdatedAt: row.updated_at,
    ...(row.deleted_at ? { _deleted: true } : {}),
  };
}

function latestUpdatedAt(...rows) {
  const timestamps = rows.flat().map((row) => row?.updated_at).filter(Boolean).sort();
  return timestamps.at(-1) || null;
}

function productSyncTime(product, fallback = '') {
  const value = product?._syncUpdatedAt || fallback;
  const time = cursorTimeMs(value);
  return Number.isFinite(time) ? time : 0;
}

function getProductTombstones() {
  try {
    const value = JSON.parse(localStorage.getItem(PRODUCT_TOMBSTONES_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item?._deleted && item.id != null) : [];
  } catch {
    return [];
  }
}

function saveProductTombstones(products) {
  try {
    const tombstones = products.filter((item) => item?._deleted && item.id != null);
    localStorage.setItem(PRODUCT_TOMBSTONES_KEY, JSON.stringify(tombstones));
  } catch { /* localStorage may be unavailable */ }
}

export function stampProductForSync(product) {
  return { ...product, _syncUpdatedAt: new Date().toISOString() };
}

export function rememberProductDeletion(id) {
  const now = new Date().toISOString();
  const tombstones = getProductTombstones().filter((item) => String(item.id) !== String(id));
  saveProductTombstones([...tombstones, { id, _deleted: true, _syncUpdatedAt: now }]);
}

export function getProductsForSync(products) {
  return [...(Array.isArray(products) ? products : []), ...getProductTombstones()];
}

/** 逐筆合併商品；較新的修改或刪除記錄勝出，避免舊裝置復活已刪商品。 */
export function mergeProductArrays(localProducts, remoteProducts, remoteUpdatedAt = '') {
  const map = new Map();
  for (const product of (remoteProducts || [])) {
    if (product?.id == null) continue;
    const normalized = product._syncUpdatedAt
      ? product
      : { ...product, _syncUpdatedAt: remoteUpdatedAt || new Date(0).toISOString() };
    map.set(String(product.id), normalized);
  }
  for (const product of (localProducts || [])) {
    if (product?.id == null) continue;
    const key = String(product.id);
    const existing = map.get(key);
    if (!existing || productSyncTime(product) >= productSyncTime(existing)) map.set(key, product);
  }
  return Array.from(map.values());
}

/** 保存刪除記錄供下次上傳，回傳只供畫面使用的有效商品。 */
export function applyProductSyncResult(products) {
  const list = Array.isArray(products) ? products : [];
  saveProductTombstones(list);
  return list.filter((item) => !item?._deleted);
}

function getOrderTombstones() {
  try {
    const value = JSON.parse(localStorage.getItem(ORDER_TOMBSTONES_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item?._deleted && item.id) : [];
  } catch {
    return [];
  }
}

function saveOrderTombstones(orders) {
  try {
    localStorage.setItem(ORDER_TOMBSTONES_KEY, JSON.stringify(
      orders.filter((item) => item?._deleted && item.id)
    ));
  } catch { /* localStorage may be unavailable */ }
}

export function rememberOrderDeletion(id) {
  const tombstones = getOrderTombstones().filter((item) => String(item.id) !== String(id));
  saveOrderTombstones([...tombstones, { id, _deleted: true, _syncUpdatedAt: new Date().toISOString() }]);
}

export function getOrdersForSync(orders) {
  return [...(Array.isArray(orders) ? orders : []), ...getOrderTombstones()];
}

export function mergeOrderArrays(localOrders, remoteOrders, remoteUpdatedAt = '') {
  const map = new Map();
  for (const order of (remoteOrders || [])) {
    if (!order?.id) continue;
    map.set(String(order.id), order._syncUpdatedAt
      ? order
      : { ...order, _syncUpdatedAt: remoteUpdatedAt || new Date(0).toISOString() });
  }
  for (const order of (localOrders || [])) {
    if (!order?.id) continue;
    const key = String(order.id);
    const existing = map.get(key);
    if (!existing || productSyncTime(order) >= productSyncTime(existing)) map.set(key, order);
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export function applyOrderSyncResult(orders) {
  const list = Array.isArray(orders) ? orders : [];
  saveOrderTombstones(list);
  return list.filter((item) => !item?._deleted);
}

/** 訂單只同步交易快照必要欄位，避免每筆訂單重複夾帶 Base64 商品圖片。 */
function compactOrdersForCloud(orders) {
  return (orders || []).map((order) => {
    if (order?._deleted) return order;
    return {
      ...order,
      items: (order.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku || '',
        price: item.price,
        qty: item.qty,
        ...(item.image && !String(item.image).startsWith('data:') ? { image: item.image } : {}),
      })),
    };
  });
}

export async function checkConnection() {
  const c = getClient();
  if (!c) return { ok: false, error: '未設定 Supabase（或建置時未帶入 VITE_*，請重新部署）' };
  try {
    const { data, error } = await c.from(SETTINGS_TABLE).select('id').eq('id', STORE_ID).maybeSingle();
    if (error) return { ok: false, error: error.message || String(error) };
    if (!data) {
      return {
        ok: false,
        error: '讀不到新版同步設定：請執行 sql/supabase_normalized_sync_v2.sql 或檢查 RLS',
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** 取得雲端目前各欄的筆數（診斷用） */
export async function fetchCloudStats() {
  const c = getClient();
  if (!c) return null;
  try {
    const [products, orders, settings] = await Promise.all([
      c.from(PRODUCT_TABLE).select('id,deleted_at,updated_at'),
      c.from(ORDER_TABLE).select('id,deleted_at,updated_at'),
      c.from(SETTINGS_TABLE).select('categories,updated_at').eq('id', STORE_ID).maybeSingle(),
    ]);
    if (products.error || orders.error || settings.error || !settings.data) return null;
    return {
      products: (products.data || []).filter((row) => !row.deleted_at).length,
      orders: (orders.data || []).filter((row) => !row.deleted_at).length,
      categories: Array.isArray(settings.data.categories) ? settings.data.categories.length : 0,
      updatedAt: latestUpdatedAt(products.data || [], orders.data || [], [settings.data]),
    };
  } catch {
    return null;
  }
}

/** 清除本機游標，下次 refreshFromCloud 會強制比對雲端並拉取 */
export function clearRemoteCursor() {
  try { localStorage.removeItem(REMOTE_TS_KEY); } catch { /* empty */ }
}

export async function testUpload() {
  const c = getClient();
  if (!c) return { ok: false, error: '未設定 Supabase（或建置時未帶入 VITE_*）' };
  try {
    const { data, error } = await c
      .from(SETTINGS_TABLE)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', STORE_ID)
      .select('updated_at');
    if (error) return { ok: false, error: error.message || String(error) };
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    if (rows.length === 0) {
      return {
        ok: false,
        error:
          '更新 0 筆：請確認 (1) store_data 有 id=default (2) VITE_STORE_KEY 與表內 store_key 完全相同 (3) RLS policy 允許 x-store-key',
      };
    }
    const updatedAt = rows[0]?.updated_at;
    if (updatedAt) setRemoteCursor(updatedAt);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** 從雲端取得完整訂單（報表用，不受本機 localStorage 限制） */
export async function fetchCloudOrders() {
  const c = getClient();
  if (!c) return null;
  try {
    const { data, error } = await c.from(ORDER_TABLE).select('id,data,updated_at,deleted_at');
    if (error) return null;
    return applyOrderSyncResult((data || []).map(rowToEntity));
  } catch { return null; }
}

export async function fetchStoreData() {
  const c = getClient();
  if (!c) return null;
  try {
    const [products, orders, settings] = await Promise.all([
      c.from(PRODUCT_TABLE).select('id,data,updated_at,deleted_at'),
      c.from(ORDER_TABLE).select('id,data,updated_at,deleted_at'),
      c.from(SETTINGS_TABLE).select('categories,store_settings,updated_at').eq('id', STORE_ID).maybeSingle(),
    ]);
    const error = products.error || orders.error || settings.error;
    if (error || !settings.data) throw new Error(error?.message || '讀不到雲端設定');
    const updatedAt = latestUpdatedAt(products.data || [], orders.data || [], [settings.data]);
    return {
      products: (products.data || []).map(rowToEntity),
      orders: (orders.data || []).map(rowToEntity),
      categories: Array.isArray(settings.data.categories) ? settings.data.categories : [],
      store: settings.data.store_settings && typeof settings.data.store_settings === 'object' ? settings.data.store_settings : {},
      updatedAt,
    };
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[sync] fetchStoreData', err);
    throw err;
  }
}

/**
 * 先拉遠端訂單合併再上傳，降低覆蓋其他裝置訂單的風險
 */
async function mergeAndUploadOnce(c, getCurrentData, scope) {
  const storeKey = getSyncEnv('VITE_STORE_KEY');
  const local = getCurrentData();
  const now = new Date().toISOString();

  if (scope === 'products') {
    const { data: rows, error: readError } = await c.from(PRODUCT_TABLE).select('id,data,updated_at,deleted_at');
    if (readError) throw readError;
    const merged = mergeProductArrays(getProductsForSync(local.products || []), (rows || []).map(rowToEntity));
    const payload = merged.map((product) => {
      const { _deleted, _syncUpdatedAt, ...data } = product;
      const updatedAt = _syncUpdatedAt || now;
      return { id: String(product.id), store_key: storeKey, data, updated_at: updatedAt, deleted_at: _deleted ? updatedAt : null };
    });
    const { error } = await c.from(PRODUCT_TABLE).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    applyProductSyncResult(merged);
  } else if (scope === 'orders') {
    const { data: rows, error: readError } = await c.from(ORDER_TABLE).select('id,data,updated_at,deleted_at');
    if (readError) throw readError;
    const merged = compactOrdersForCloud(mergeOrderArrays(getOrdersForSync(local.orders || []), (rows || []).map(rowToEntity)));
    const payload = merged.map((order) => {
      const { _deleted, _syncUpdatedAt, ...data } = order;
      const updatedAt = _syncUpdatedAt || now;
      return { id: String(order.id), store_key: storeKey, data, updated_at: updatedAt, deleted_at: _deleted ? updatedAt : null };
    });
    const { error } = await c.from(ORDER_TABLE).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    applyOrderSyncResult(merged);
  } else {
    const { data: remote, error: readError } = await c.from(SETTINGS_TABLE).select('categories,store_settings').eq('id', STORE_ID).maybeSingle();
    if (readError) throw readError;
    const categories = (local.categories || []).length > 0 ? local.categories : (remote?.categories || []);
    const store = { ...(remote?.store_settings || {}), ...(local.store || {}) };
    const { error } = await c.from(SETTINGS_TABLE).upsert({ id: STORE_ID, store_key: storeKey, categories, store_settings: store, updated_at: now }, { onConflict: 'id' });
    if (error) throw error;
  }

  setRemoteCursor(now);
  return true;
}

async function mergeAndUpload(c, getCurrentData, scopes = ['products', 'orders', 'settings']) {
  const list = Array.isArray(scopes) ? scopes : [scopes];
  for (const scope of list) {
    let completed = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await mergeAndUploadOnce(c, getCurrentData, scope)) {
        completed = true;
        break;
      }
    }
    if (!completed) throw new Error('資料同時被其他裝置更新，已重試 3 次，請再按一次同步');
  }
  return true;
}

function enqueueUpload(task) {
  const queued = uploadQueue.then(task, task);
  uploadQueue = queued.catch(() => {});
  return queued;
}

/**
 * 上傳目前資料到雲端（debounce；合併訂單後再上傳）
 * onUploadEnd(ok: boolean)
 */
export function scheduleUpload(getCurrentData, options = {}) {
  const c = getClient();
  if (!c || typeof getCurrentData !== 'function') return;
  const requested = options.scope || ['products', 'orders', 'settings'];
  for (const scope of (Array.isArray(requested) ? requested : [requested])) pendingUploadScopes.add(scope);
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    uploadTimer = null;
    const scopes = Array.from(pendingUploadScopes);
    pendingUploadScopes = new Set();
    const { onUploadStart, onUploadEnd, onUploadError } = options;
    let ok = false;
    try {
      onUploadStart?.();
      ok = await enqueueUpload(() => mergeAndUpload(c, getCurrentData, scopes));
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[sync] upload failed', err);
      onUploadError?.(err?.message || String(err));
    }
    onUploadEnd?.(ok);
  }, UPLOAD_DEBOUNCE_MS);
}

/**
 * 立即上傳（不 debounce，合併訂單後再上傳）
 */
export async function uploadNow(getCurrentData, scopes = ['products', 'orders', 'settings']) {
  const c = getClient();
  if (!c || typeof getCurrentData !== 'function') throw new Error('Supabase 未設定');
  return await enqueueUpload(() => mergeAndUpload(c, getCurrentData, scopes));
}

export function subscribeToStore(onData) {
  const c = getClient();
  if (!c || typeof onData !== 'function') return () => {};
  let refreshTimer = null;
  const refresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      refreshTimer = null;
      try {
        const data = await fetchStoreData();
        if (data) onData(data);
      } catch { /* HTTP polling remains as fallback */ }
    }, 120);
  };
  const channel = c
    .channel('pos_v2_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: PRODUCT_TABLE }, refresh
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: ORDER_TABLE }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: SETTINGS_TABLE, filter: `id=eq.${STORE_ID}` }, refresh)
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (import.meta.env.DEV) console.warn('[sync] Realtime', status, err?.message || err);
      }
    });
  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    c.removeChannel(channel);
  };
}
