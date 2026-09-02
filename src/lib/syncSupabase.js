/**
 * 多台裝置同步：使用 Supabase 雲端儲存 + Realtime
 * 設定 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、VITE_STORE_KEY 後啟用（建置時寫入），未設定則僅使用本機 localStorage
 */

import { createClient } from '@supabase/supabase-js';

const STORE_ID = 'default';
const TABLE = 'store_data';
/** 與雲端 store_data.updated_at 對齊，避免輪詢／即時重複套用或誤覆寫 */
const REMOTE_TS_KEY = 'pos_sync_remote_updated_at';
const PRODUCT_TOMBSTONES_KEY = 'pos_sync_product_tombstones';
const ORDER_TOMBSTONES_KEY = 'pos_sync_order_tombstones';

let client = null;
let uploadTimer = null;
let uploadQueue = Promise.resolve();
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
  const tombstones = getProductTombstones().filter((item) => item.id !== id);
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
    map.set(product.id, normalized);
  }
  for (const product of (localProducts || [])) {
    if (product?.id == null) continue;
    const existing = map.get(product.id);
    if (!existing || productSyncTime(product) >= productSyncTime(existing)) map.set(product.id, product);
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
  const tombstones = getOrderTombstones().filter((item) => item.id !== id);
  saveOrderTombstones([...tombstones, { id, _deleted: true, _syncUpdatedAt: new Date().toISOString() }]);
}

export function getOrdersForSync(orders) {
  return [...(Array.isArray(orders) ? orders : []), ...getOrderTombstones()];
}

export function mergeOrderArrays(localOrders, remoteOrders, remoteUpdatedAt = '') {
  const map = new Map();
  for (const order of (remoteOrders || [])) {
    if (!order?.id) continue;
    map.set(order.id, order._syncUpdatedAt
      ? order
      : { ...order, _syncUpdatedAt: remoteUpdatedAt || new Date(0).toISOString() });
  }
  for (const order of (localOrders || [])) {
    if (!order?.id) continue;
    const existing = map.get(order.id);
    if (!existing || productSyncTime(order) >= productSyncTime(existing)) map.set(order.id, order);
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

export async function checkConnection() {
  const c = getClient();
  if (!c) return { ok: false, error: '未設定 Supabase（或建置時未帶入 VITE_*，請重新部署）' };
  try {
    const { data, error } = await c.from(TABLE).select('id').eq('id', STORE_ID).maybeSingle();
    if (error) return { ok: false, error: error.message || String(error) };
    if (!data) {
      return {
        ok: false,
        error: '讀不到 id=default 這一筆：請在 Supabase 執行 sql/supabase_store_data.sql 或檢查 RLS',
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
    const { data, error } = await c.from(TABLE).select('*').eq('id', STORE_ID).maybeSingle();
    if (error || !data) return null;
    return {
      products: Array.isArray(data.products) ? data.products.length : 0,
      orders: Array.isArray(data.orders) ? data.orders.length : 0,
      categories: Array.isArray(data.categories) ? data.categories.length : 0,
      updatedAt: data.updated_at || null,
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
      .from(TABLE)
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
    const { data, error } = await c.from(TABLE).select('orders').eq('id', STORE_ID).maybeSingle();
    if (error || !data) return null;
    return applyOrderSyncResult(Array.isArray(data.orders) ? data.orders : []);
  } catch { return null; }
}

export async function fetchStoreData() {
  const c = getClient();
  if (!c) return null;
  try {
    const { data, error } = await c.from(TABLE).select('*').eq('id', STORE_ID).maybeSingle();
    if (error || !data) return null;
    const updatedAt = data.updated_at || null;
    return {
      products: Array.isArray(data.products) ? data.products : [],
      orders: Array.isArray(data.orders) ? data.orders : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      store: data.store_settings && typeof data.store_settings === 'object' ? data.store_settings : {},
      updatedAt,
    };
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[sync] fetchStoreData', err);
    return null;
  }
}

/**
 * 先拉遠端訂單合併再上傳，降低覆蓋其他裝置訂單的風險
 */
async function mergeAndUploadOnce(c, getCurrentData) {
  const storeKey = getSyncEnv('VITE_STORE_KEY');
  const local = getCurrentData();

  let remoteOrders = [];
  let remoteProducts = [];
  let remoteCategories = [];
  let remoteStore = {};
  let remoteUpdatedAt = '';
  try {
    const { data } = await c
      .from(TABLE)
      .select('orders, products, categories, store_settings, updated_at')
      .eq('id', STORE_ID)
      .maybeSingle();
    if (data) {
      if (Array.isArray(data.orders)) remoteOrders = data.orders;
      if (Array.isArray(data.products)) remoteProducts = data.products;
      if (Array.isArray(data.categories)) remoteCategories = data.categories;
      if (data.store_settings && typeof data.store_settings === 'object') remoteStore = data.store_settings;
      remoteUpdatedAt = data.updated_at || '';
    }
  } catch { /* 拉不到就用本地 */ }

  const mergedOrders = mergeOrderArrays(getOrdersForSync(local.orders || []), remoteOrders, remoteUpdatedAt);

  const lp = getProductsForSync(local.products || []);
  const rp = remoteProducts || [];
  const mergedProducts = mergeProductArrays(lp, rp, remoteUpdatedAt);

  const lc = local.categories || [];
  const rc = remoteCategories || [];
  const mergedCategories = lc.length === 0 && rc.length > 0 ? rc : lc;

  const mergedStore = { ...remoteStore, ...(local.store && typeof local.store === 'object' ? local.store : {}) };

  let query = c
    .from(TABLE)
    .update({
      store_key: typeof storeKey === 'string' ? storeKey : '',
      products: mergedProducts,
      orders: mergedOrders,
      categories: mergedCategories,
      store_settings: mergedStore,
      updated_at: new Date().toISOString(),
    })
    .eq('id', STORE_ID);
  if (remoteUpdatedAt) query = query.eq('updated_at', remoteUpdatedAt);
  const { data: rows, error } = await query.select('updated_at');

  if (error) {
    const msg = error.message || error.details || JSON.stringify(error);
    throw new Error(`上傳失敗: ${msg}`);
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return false;
  applyProductSyncResult(mergedProducts);
  applyOrderSyncResult(mergedOrders);
  if (row.updated_at) setRemoteCursor(row.updated_at);
  return true;
}

async function mergeAndUpload(c, getCurrentData) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await mergeAndUploadOnce(c, getCurrentData)) return true;
  }
  throw new Error('商品資料同時被其他裝置更新，已重試 3 次，請再按一次同步');
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
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    uploadTimer = null;
    const { onUploadStart, onUploadEnd, onUploadError } = options;
    let ok = false;
    try {
      onUploadStart?.();
      ok = await enqueueUpload(() => mergeAndUpload(c, getCurrentData));
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
export async function uploadNow(getCurrentData) {
  const c = getClient();
  if (!c || typeof getCurrentData !== 'function') throw new Error('Supabase 未設定');
  return await enqueueUpload(() => mergeAndUpload(c, getCurrentData));
}

export function subscribeToStore(onData) {
  const c = getClient();
  if (!c || typeof onData !== 'function') return () => {};
  const channel = c
    .channel('store_data_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${STORE_ID}` },
      (payload) => {
        const row = payload.new;
        if (!row) return;
        if (row.updated_at) setRemoteCursor(row.updated_at);
        onData({
          products: applyProductSyncResult(Array.isArray(row.products) ? row.products : []),
          orders: applyOrderSyncResult(Array.isArray(row.orders) ? row.orders : []),
          categories: Array.isArray(row.categories) ? row.categories : [],
          store: row.store_settings && typeof row.store_settings === 'object' ? row.store_settings : {},
        });
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (import.meta.env.DEV) console.warn('[sync] Realtime', status, err?.message || err);
      }
    });
  return () => {
    c.removeChannel(channel);
  };
}
