/**
 * 多台裝置同步：使用 Supabase 雲端儲存 + Realtime
 * 設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY 後啟用，未設定則僅使用本機 localStorage
 */

import { createClient } from '@supabase/supabase-js';

const STORE_ID = 'default';
const TABLE = 'store_data';

let client = null;
let uploadTimer = null;
const UPLOAD_DEBOUNCE_MS = 1500;

function getClient() {
  if (client !== null) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const storeKey = import.meta.env.VITE_STORE_KEY;
  if (!url || !key || typeof url !== 'string' || typeof key !== 'string') return null;
  // 啟用「店鋪密鑰」後必須提供 storeKey，否則不同步（避免匿名公開讀寫）
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

/**
 * 是否已設定 Supabase（會啟用同步）
 */
export function isSyncEnabled() {
  return !!getClient();
}

/**
 * 檢查雲端連線是否正常，回傳 { ok: true } 或 { ok: false, error: string }
 */
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

/**
 * 測試「寫入」權限是否正常（只更新 updated_at，不覆蓋資料）
 * 回傳 { ok: true } 或 { ok: false, error: string }
 */
export async function testUpload() {
  const c = getClient();
  if (!c) return { ok: false, error: '未設定 Supabase' };
  try {
    const { error } = await c
      .from(TABLE)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', STORE_ID);
    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 從雲端取得最新資料，失敗或未設定則回傳 null
 */
export async function fetchStoreData() {
  const c = getClient();
  if (!c) return null;
  try {
    const { data, error } = await c.from(TABLE).select('*').eq('id', STORE_ID).maybeSingle();
    if (error || !data) return null;
    return {
      products: Array.isArray(data.products) ? data.products : [],
      orders: Array.isArray(data.orders) ? data.orders : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      store: data.store_settings && typeof data.store_settings === 'object' ? data.store_settings : {},
    };
  } catch {
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
 * 先拉遠端資料合併訂單再上傳，確保不覆蓋其他裝置的訂單
 */
async function mergeAndUpload(c, getCurrentData) {
  const storeKey = import.meta.env.VITE_STORE_KEY;
  const local = getCurrentData();

  // 先拉遠端訂單
  let remoteOrders = [];
  try {
    const { data } = await c.from(TABLE).select('orders').eq('id', STORE_ID).maybeSingle();
    if (data && Array.isArray(data.orders)) remoteOrders = data.orders;
  } catch { /* 拉不到就用本地的 */ }

  const mergedOrders = mergeOrderArrays(local.orders || [], remoteOrders);

  const { error } = await c.from(TABLE).upsert(
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
  );
  return !error;
}

/**
 * 上傳目前資料到雲端（會 debounce，合併訂單後再上傳）
 */
export function scheduleUpload(getCurrentData, options = {}) {
  const c = getClient();
  if (!c || typeof getCurrentData !== 'function') return;
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    uploadTimer = null;
    const { onUploadStart, onUploadEnd } = options;
    let ok = false;
    try {
      onUploadStart?.();
      ok = await mergeAndUpload(c, getCurrentData);
    } catch { /* upload failed */ }
    onUploadEnd?.(ok);
  }, UPLOAD_DEBOUNCE_MS);
}

/**
 * 立即上傳（不 debounce，合併訂單後再上傳），回傳 boolean
 */
export async function uploadNow(getCurrentData) {
  const c = getClient();
  if (!c || typeof getCurrentData !== 'function') return false;
  try {
    return await mergeAndUpload(c, getCurrentData);
  } catch { /* empty */ }
  return false;
}

/**
 * 訂閱雲端資料變更（其他裝置更新時會觸發）
 * onData: (data) => void，data 形狀同 fetchStoreData
 * 回傳 unsubscribe 函式
 */
export function subscribeToStore(onData) {
  const c = getClient();
  if (!c || typeof onData !== 'function') return () => {};
  const channel = c.channel('store_data_changes').on(
    'postgres_changes',
    { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${STORE_ID}` },
    (payload) => {
      const row = payload.new;
      if (!row) return;
      onData({
        products: Array.isArray(row.products) ? row.products : [],
        orders: Array.isArray(row.orders) ? row.orders : [],
        categories: Array.isArray(row.categories) ? row.categories : [],
        store: row.store_settings && typeof row.store_settings === 'object' ? row.store_settings : {},
      });
    }
  ).subscribe();
  return () => {
    c.removeChannel(channel);
  };
}
