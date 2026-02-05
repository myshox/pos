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
  } catch (_) {
    return null;
  }
}

/**
 * 上傳目前資料到雲端（會 debounce）
 * getCurrentData: () => ({ products, orders, categories, store })
 * options: { onUploadStart?: () => void, onUploadEnd?: () => void }
 */
export function scheduleUpload(getCurrentData, options = {}) {
  const c = getClient();
  if (!c || typeof getCurrentData !== 'function') return;
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    uploadTimer = null;
    const { onUploadStart, onUploadEnd } = options;
    try {
      onUploadStart?.();
      const storeKey = import.meta.env.VITE_STORE_KEY;
      const d = getCurrentData();
      await c.from(TABLE).upsert(
        {
          id: STORE_ID,
          // 重要：啟用店鋪密鑰 RLS 時，INSERT/UPSERT 需要帶 store_key 才能通過 policy
          store_key: typeof storeKey === 'string' ? storeKey : '',
          products: d.products || [],
          orders: d.orders || [],
          categories: d.categories || [],
          store_settings: d.store || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch (_) {}
    onUploadEnd?.();
  }, UPLOAD_DEBOUNCE_MS);
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
