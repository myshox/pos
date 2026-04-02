/**
 * 多台裝置同步：使用 Supabase 雲端儲存 + Realtime
 * 設定 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、VITE_STORE_KEY 後啟用（建置時寫入），未設定則僅使用本機 localStorage
 */

import { createClient } from '@supabase/supabase-js';

const STORE_ID = 'default';
const TABLE = 'store_data';
/** 與雲端 store_data.updated_at 對齊，避免輪詢／即時重複套用或誤覆寫 */
const REMOTE_TS_KEY = 'pos_sync_remote_updated_at';

let client = null;
let uploadTimer = null;
const UPLOAD_DEBOUNCE_MS = 1500;

/** 輪詢拉取間隔（Realtime 在部分 WebView 不穩時補強） */
export const POLL_INTERVAL_MS = 30000;

function getClient() {
  if (client !== null) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const storeKey = import.meta.env.VITE_STORE_KEY;
  if (!url || !key || typeof url !== 'string' || typeof key !== 'string') return null;
  if (!storeKey || typeof storeKey !== 'string') return null;
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
  } catch (_) {
    return null;
  }
}

export function setRemoteCursor(iso) {
  if (!iso || typeof iso !== 'string') return;
  try {
    localStorage.setItem(REMOTE_TS_KEY, iso);
  } catch (_) {}
}

/**
 * 雲端是否比本機游標新（用於輪詢拉取）
 * 無游標時：僅在雲端有商品／訂單／分類資料時才視為「該套用」
 */
export function isRemoteAheadOfCursor(remote) {
  if (!remote?.updatedAt) return false;
  const last = getRemoteCursor();
  const hasPayload =
    (remote.products?.length > 0) ||
    (remote.orders?.length > 0) ||
    (remote.categories?.length > 0);
  if (!last) return hasPayload;
  return new Date(remote.updatedAt).getTime() > new Date(last).getTime();
}

export function isSyncEnabled() {
  return !!getClient();
}

export async function checkConnection() {
  const c = getClient();
  if (!c) return { ok: false, error: '未設定 Supabase' };
  try {
    const { error } = await c.from(TABLE).select('id').eq('id', STORE_ID).maybeSingle();
    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function testUpload() {
  const c = getClient();
  if (!c) return { ok: false, error: '未設定 Supabase' };
  try {
    const { data, error } = await c
      .from(TABLE)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', STORE_ID)
      .select('updated_at')
      .maybeSingle();
    if (error) return { ok: false, error: error.message || String(error) };
    if (data?.updated_at) setRemoteCursor(data.updated_at);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
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
 * 合併本地與遠端訂單（以 id 去重，保留兩邊所有訂單）
 */
function mergeOrderArrays(localOrders, remoteOrders) {
  const map = new Map();
  for (const o of (remoteOrders || [])) map.set(o.id, o);
  for (const o of (localOrders || [])) {
    const existing = map.get(o.id);
    if (!existing) {
      map.set(o.id, o);
    } else if (o.voided && !existing.voided) {
      map.set(o.id, o);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 先拉遠端訂單合併再上傳，降低覆蓋其他裝置訂單的風險
 */
async function mergeAndUpload(c, getCurrentData) {
  const storeKey = import.meta.env.VITE_STORE_KEY;
  const local = getCurrentData();

  let remoteOrders = [];
  try {
    const { data } = await c.from(TABLE).select('orders').eq('id', STORE_ID).maybeSingle();
    if (data && Array.isArray(data.orders)) remoteOrders = data.orders;
  } catch { /* 拉不到就用本地 */ }

  const mergedOrders = mergeOrderArrays(local.orders || [], remoteOrders);

  const { data: row, error } = await c
    .from(TABLE)
    .upsert(
      {
        id: STORE_ID,
        store_key: typeof storeKey === 'string' ? storeKey : '',
        products: local.products || [],
        orders: mergedOrders,
        categories: local.categories || [],
        store_settings: local.store || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('updated_at')
    .single();

  if (error) return false;
  if (row?.updated_at) setRemoteCursor(row.updated_at);
  return true;
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
      ok = await mergeAndUpload(c, getCurrentData);
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
  if (!c || typeof getCurrentData !== 'function') return false;
  try {
    return await mergeAndUpload(c, getCurrentData);
  } catch {
    return false;
  }
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
          products: Array.isArray(row.products) ? row.products : [],
          orders: Array.isArray(row.orders) ? row.orders : [],
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
