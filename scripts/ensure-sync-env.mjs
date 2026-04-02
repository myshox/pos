/**
 * Capacitor 打包前檢查：必須有 .env（或 .env.production）內三個 VITE_*，
 * 或 public/config.json，否則裝到手機上的 App 不會連 Supabase（常見：安卓正常、iOS 商品 0）。
 * 不需檢查時可設環境變數 SKIP_SYNC_CHECK=1
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

if (process.env.SKIP_SYNC_CHECK === '1') {
  process.exit(0);
}

function readEnvFiles() {
  const names = ['.env.production.local', '.env.local', '.env.production', '.env'];
  for (const n of names) {
    const p = join(root, n);
    if (existsSync(p)) {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        /* empty */
      }
    }
  }
  return '';
}

function hasAllViteFromEnvText(text) {
  if (!text || !text.trim()) return false;
  const keys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_STORE_KEY'];
  return keys.every((k) => {
    const re = new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm');
    const m = text.match(re);
    if (!m) return false;
    const v = m[1].replace(/^["']|["']$/g, '').trim();
    return v.length > 0 && !v.startsWith('#');
  });
}

function hasPublicConfigJson() {
  const p = join(root, 'public', 'config.json');
  if (!existsSync(p)) return false;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const u = String(j.VITE_SUPABASE_URL || '').trim();
    const k = String(j.VITE_SUPABASE_ANON_KEY || '').trim();
    const s = String(j.VITE_STORE_KEY || '').trim();
    return u.length > 0 && k.length > 0 && s.length > 0;
  } catch {
    return false;
  }
}

const envText = readEnvFiles();
const ok = hasAllViteFromEnvText(envText) || hasPublicConfigJson();

if (!ok) {
  console.error('');
  console.error('[POS] 無法打包 Capacitor：找不到 Supabase 設定。');
  console.error('  請擇一：');
  console.error('  1) 在專案根目錄建立 .env（或 .env.production），填入 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、VITE_STORE_KEY');
  console.error('  2) 複製 public/config.example.json 為 public/config.json 並填寫（勿提交 Git）');
  console.error('  若確定不要雲端同步，可執行：SKIP_SYNC_CHECK=1 npm run build');
  console.error('');
  process.exit(1);
}

process.exit(0);
