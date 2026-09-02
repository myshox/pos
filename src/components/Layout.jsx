import React, { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { StoreContext } from '../context/StoreContext';

function SyncStatusBadge() {
  const store = useContext(StoreContext);
  const { t } = useLocale();
  const isSyncEnabled = store?.isSyncEnabled ?? false;
  const isSyncing = store?.isSyncing ?? false;
  const syncError = store?.syncError ?? null;
  const isOnline = store?.isOnline ?? true;
  const hasPendingSync = store?.hasPendingSync ?? false;
  const lastSyncAt = store?.lastSyncAt ?? 0;
  const manualSync = store?.manualSync;

  if (!isSyncEnabled) return null;

  // 同步錯誤
  if (syncError) {
    return (
      <button
        type="button"
        onClick={() => { alert(syncError); manualSync?.(); }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/40 hover:bg-red-500/60 text-white text-xs font-medium transition touch-manipulation min-h-[32px]"
      >
        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        <span>{t('syncError')}</span>
      </button>
    );
  }

  // 離線狀態
  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/30 text-white text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        {t('syncOffline')}
      </span>
    );
  }

  // 同步中
  if (isSyncing) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/25 text-white text-xs font-medium animate-pulse">
        <span className="w-2 h-2 rounded-full bg-white border border-white/60" />
        {t('syncSyncing')}
      </span>
    );
  }

  // 有待同步資料
  if (hasPendingSync) {
    return (
      <button
        type="button"
        onClick={() => manualSync?.()}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-white text-xs font-medium transition touch-manipulation min-h-[32px]"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        {t('syncPending')}
      </button>
    );
  }

  // 已同步 — 顯示上次同步時間，可點擊手動同步
  const timeAgo = lastSyncAt > 0 ? formatTimeAgo(lastSyncAt, t) : '';
  return (
    <button
      type="button"
      onClick={() => manualSync?.()}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-white text-xs font-medium transition touch-manipulation min-h-[32px]"
      title={t('syncManualHint')}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400" />
      {timeAgo ? `${t('syncSynced')} ${timeAgo}` : t('syncSynced')}
    </button>
  );
}

function formatTimeAgo(ts, t) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return t('syncJustNow');
  if (diff < 3600) return `${Math.floor(diff / 60)}${t('syncMinAgo')}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t('syncHrAgo')}`;
  return `${Math.floor(diff / 86400)}${t('syncDayAgo')}`;
}

export default function Layout({ children }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isShowcase = location.pathname.startsWith('/showcase');
  const isLegal = location.pathname.startsWith('/legal');
  const { t, lang, setLang, LANGS, langLabels } = useLocale();
  const { store } = useContext(StoreContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const companyName = store?.name || '蘑菇宇宙工作室';
  const taxId = store?.taxId || '95148616';
  const phone = store?.phone || '0908-180-610';
  const companyEmail = store?.companyEmail || 'mogu5486047@gmail.com';
  const supportEmail = store?.supportEmail || 'myshoxisgood@gmail.com';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="header-bar sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <Link to="/" className="brand-lockup flex items-center gap-2 sm:gap-3 shrink-0 min-h-[44px] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50" onClick={() => setMenuOpen(false)}>
            <span className="brand-mascot"><img src="/logo.png" alt="" onError={(e) => { e.target.style.display = 'none'; }} /></span>
            <span><b>{t('appName')}</b><small>MARKET POS</small></span>
          </Link>

          <SyncStatusBadge />

          {/* 桌面：語言 + 導覽 */}
          <div className="hidden md:flex items-center gap-3">
            <div className="language-switcher flex rounded-xl overflow-hidden">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 text-sm font-medium transition min-h-[40px] ${lang === l ? 'is-active' : ''}`}
                >
                  {langLabels[l]}
                </button>
              ))}
            </div>
            <nav className="flex gap-2">
              <Link to="/" className={`nav-pill ${!isAdmin && !isShowcase && !isLegal ? 'is-active' : ''}`}>
                {t('navCheckout')}
              </Link>
              <Link to="/showcase" className={`nav-pill ${isShowcase ? 'is-active' : ''}`}>
                {t('navShowcase')}
              </Link>
              <Link to="/admin" className={`nav-pill ${isAdmin ? 'is-active' : ''}`}>
                {t('navAdmin')}
              </Link>
            </nav>
          </div>

          {/* 手機：漢堡按鈕 */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-xl text-slate-800 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('menu')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* 手機展開選單 */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/15 bg-slate-950/95 px-4 py-4 flex flex-col gap-2">
            <div className="flex gap-2 mb-2">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${lang === l ? 'bg-white text-teal-700 shadow-sm' : 'bg-white/10 text-white/95'}`}
                >
                  {langLabels[l]}
                </button>
              ))}
            </div>
            <Link to="/" className="py-3 px-4 rounded-xl font-medium text-center bg-white text-teal-700 shadow-sm" onClick={() => setMenuOpen(false)}>
              {t('navCheckout')}
            </Link>
            <Link to="/showcase" className="py-3 px-4 rounded-xl font-medium text-center text-white/95 bg-white/15" onClick={() => setMenuOpen(false)}>
              {t('navShowcase')}
            </Link>
            <Link to="/admin" className="py-3 px-4 rounded-xl font-medium text-center text-white/95 bg-white/15" onClick={() => setMenuOpen(false)}>
              {t('navAdmin')}
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-5 py-4 sm:py-5 min-w-0 text-slate-800 antialiased">
        {children}
      </main>
      <footer className="site-footer">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div><strong>{companyName}</strong><span>統一編號 {taxId}</span></div>
          <div className="flex flex-wrap gap-x-4 gap-y-2"><a href={`mailto:${companyEmail}`}>公司信箱：{companyEmail}</a><a href={`mailto:${supportEmail}`}>客服信箱</a><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a><Link to="/legal">退換貨與商店資訊</Link></div>
        </div>
      </footer>
    </div>
  );
}
