import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useStore } from '../context/StoreContext';
import ProductManager from '../components/ProductManager';
import CategoryManager from '../components/CategoryManager';
import OrderList from '../components/OrderList';
import ReportSettlement from '../components/ReportSettlement';
import StoreSettings from '../components/StoreSettings';
import BackupRestore from '../components/BackupRestore';
import AdminDashboard from '../components/AdminDashboard';
import InventoryPanel from '../components/InventoryPanel';

const SECTION_IDS = ['dashboard', 'orders', 'products', 'categories', 'inventory', 'report', 'settings', 'backup'];

const TAB_KEYS = {
  dashboard: 'tabDashboard',
  orders: 'tabOrders',
  products: 'tabProducts',
  categories: 'tabCategories',
  inventory: 'tabInventory',
  report: 'tabReport',
  settings: 'tabSettings',
  backup: 'tabBackup',
};

const TAB_ICONS = {
  dashboard: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" /></svg>
  ),
  products: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
  categories: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
  ),
  orders: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
  ),
  inventory: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
  ),
  report: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ),
  settings: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 2.31.826 1.37 1.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 2.31-1.37 1.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-2.31-.826-1.37-1.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-2.31 1.37-1.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  backup: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
  ),
};

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const { t } = useLocale();
  const { adminHasPin, adminLock } = useStore();
  const navigate = useNavigate();

  const handleLock = () => {
    adminLock();
    navigate('/');
  };

  const navBtn = (id) =>
    `admin-nav-button w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-medium transition min-h-[48px] ${
      tab === id ? 'is-active' : ''
    }`;

  const navBtnMobile = (id) =>
    `flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] snap-start ${
      tab === id ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-500/30' : 'bg-slate-100/90 text-slate-700 border border-slate-200/80'
    }`;

  return (
    <div className="admin-shell overflow-hidden w-full flex flex-col min-h-[min(85vh,900px)]">
      {/* 手機：橫向分頁 */}
      <div className="md:hidden border-b border-slate-200 bg-slate-50/90">
        <div className="flex overflow-x-auto gap-2 p-3 snap-x scrollbar-thin">
          {SECTION_IDS.map((id) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={navBtnMobile(id)}>
              {TAB_ICONS[id]}
              <span className="whitespace-nowrap">{t(TAB_KEYS[id])}</span>
            </button>
          ))}
        </div>
        {adminHasPin && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={handleLock}
              className="w-full py-2.5 rounded-xl text-slate-600 bg-white border border-slate-200 text-sm font-medium"
            >
              {t('adminLock')}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 min-w-0">
        {/* 桌機：側欄 */}
        <aside className="admin-sidebar hidden md:flex w-60 shrink-0 flex-col p-3 gap-1">
          <div className="admin-sidebar-head px-2 py-3 mb-2">
            <span className="admin-sidebar-mark" aria-hidden="true">M</span>
            <div>
              <strong>{t('adminConsole')}</strong>
              <p>STORE CONTROL</p>
            </div>
          </div>
          {SECTION_IDS.map((id) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={navBtn(id)}>
              {TAB_ICONS[id]}
              <span className="truncate">{t(TAB_KEYS[id])}</span>
            </button>
          ))}
          {adminHasPin && (
            <button
              type="button"
              onClick={handleLock}
              className="mt-auto w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm text-slate-600 hover:bg-slate-200/80 border border-slate-200"
            >
              {t('adminLock')}
            </button>
          )}
        </aside>

        <div className="admin-content flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="admin-page-heading">
            <div><span>{t('adminConsole')}</span><h1>{t(TAB_KEYS[tab])}</h1></div>
          </div>
          {tab === 'dashboard' && <AdminDashboard onNavigateToTab={setTab} />}
          {tab === 'orders' && <OrderList />}
          {tab === 'products' && <ProductManager />}
          {tab === 'categories' && <CategoryManager />}
          {tab === 'inventory' && <InventoryPanel />}
          {tab === 'report' && <ReportSettlement />}
          {tab === 'settings' && <StoreSettings />}
          {tab === 'backup' && <BackupRestore />}
        </div>
      </div>
    </div>
  );
}
