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
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const storeKey = String(import.meta.env.VITE_STORE_KEY || '').trim();
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
  const storeKey = String(import.meta.env.VITE_STORE_KEY || '').trim();
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
    .maybeSingle();

  if (error) return false;
  if (row?.updated_at) setRemoteCursor(row.updated_at);
  else setRemoteCursor(new Date().toISOString());
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
