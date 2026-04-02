/**
 * Capacitor／本機打包的 dist 若建置時未帶入 VITE_*，同步會完全停用（安卓與 iOS 若建置方式不同常出現「只有 iOS 沒資料」）。
 * 啟動時可選讀 public/config.json（勿提交真實金鑰；請見 public/config.example.json）。
 */
export async function loadPublicSyncConfig() {
  const hasAll =
    String(import.meta.env.VITE_SUPABASE_URL || '').trim() &&
    String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim() &&
    String(import.meta.env.VITE_STORE_KEY || '').trim();
  if (hasAll) return;
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch('/config.json', { cache: 'no-store', signal: ctrl.signal });
    window.clearTimeout(t);
    if (!r.ok) return;
    const j = await r.json();
    if (j && typeof j === 'object') {
      globalThis.__POS_SYNC_CONFIG__ = j;
    }
  } catch {
    /* 無檔案或網路失敗時仍走僅本機模式 */
  }
}
