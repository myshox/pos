import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';

export default function Layout({ children }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const { t, lang, setLang, LANGS, langLabels } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="header-bar text-amber-50/95 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-h-[44px] items-center" onClick={() => setMenuOpen(false)}>
            <img src="/logo.png" alt="" className="h-8 sm:h-10 w-auto object-contain hidden sm:block" onError={(e) => { e.target.style.display = 'none'; }} />
            <span className="text-base sm:text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-cute)' }}>{t('appName')}</span>
          </Link>

          {/* 桌面：語言 + 導覽 */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex rounded-xl overflow-hidden bg-white/10">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 text-sm font-medium transition min-h-[40px] ${lang === l ? 'bg-amber-400/90 text-white' : 'text-amber-50/90 hover:bg-white/15'}`}
                >
                  {langLabels[l]}
                </button>
              ))}
            </div>
            <nav className="flex gap-2">
              <Link to="/" className={`px-4 py-2 rounded-xl font-medium transition min-h-[40px] flex items-center ${!isAdmin ? 'bg-amber-400/85 text-white shadow-sm' : 'text-amber-50/90 hover:text-white hover:bg-white/15'}`}>
                {t('navCheckout')}
              </Link>
              <Link to="/admin" className={`px-4 py-2 rounded-xl font-medium transition min-h-[40px] flex items-center ${isAdmin ? 'bg-amber-400/85 text-white shadow-sm' : 'text-amber-50/90 hover:text-white hover:bg-white/15'}`}>
                {t('navAdmin')}
              </Link>
            </nav>
          </div>

          {/* 手機：漢堡按鈕 */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-xl text-amber-50 hover:bg-white/15 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="選單"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* 手機展開選單 */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#3d3329]/98 px-4 py-4 flex flex-col gap-2">
            <div className="flex gap-2 mb-2">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${lang === l ? 'bg-amber-400/90 text-white' : 'bg-white/10 text-amber-50/90'}`}
                >
                  {langLabels[l]}
                </button>
              ))}
            </div>
            <Link to="/" className="py-3 px-4 rounded-xl font-medium text-center bg-amber-400/85 text-white" onClick={() => setMenuOpen(false)}>
              {t('navCheckout')}
            </Link>
            <Link to="/admin" className="py-3 px-4 rounded-xl font-medium text-center text-amber-50/90 bg-white/10" onClick={() => setMenuOpen(false)}>
              {t('navAdmin')}
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 min-w-0">
        {children}
      </main>
    </div>
  );
}
