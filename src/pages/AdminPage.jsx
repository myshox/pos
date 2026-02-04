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

const TAB_IDS = ['products', 'categories', 'orders', 'report', 'settings', 'backup'];
const TAB_KEYS = {
  products: 'tabProducts',
  categories: 'tabCategories',
  orders: 'tabOrders',
  report: 'tabReport',
  settings: 'tabSettings',
  backup: 'tabBackup',
};

const TAB_ICONS = {
  products: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
  categories: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
  ),
  orders: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
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
  const [tab, setTab] = useState('products');
  const { t } = useLocale();
  const { adminHasPin, adminLock } = useStore();
  const navigate = useNavigate();

  const handleLock = () => {
    adminLock();
    navigate('/');
  };

  const tabButtonClass = (id) =>
    `flex items-center justify-center gap-2 font-medium transition min-h-[48px] ${
      tab === id ? 'bg-stone-800 text-amber-50' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
    }`;

  return (
    <div className="card-market rounded-2xl overflow-hidden w-full">
      {/* 手機：2x3 網格分頁 */}
      <div className="md:hidden grid grid-cols-2 gap-2 p-3 border-b border-stone-200">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`${tabButtonClass(id)} rounded-xl py-3 px-3 text-sm`}
          >
            {TAB_ICONS[id]}
            <span className="truncate">{t(TAB_KEYS[id])}</span>
          </button>
        ))}
        {adminHasPin && (
          <button
            type="button"
            onClick={handleLock}
            className="col-span-2 py-3 rounded-xl text-stone-500 hover:text-stone-700 hover:bg-stone-100 text-sm font-medium min-h-[48px] flex items-center justify-center gap-1"
          >
            <span>🔒</span> {t('adminLock')}
          </button>
        )}
      </div>

      {/* 桌機：橫向分頁列 + icon */}
      <div className="hidden md:block border-b border-stone-200 overflow-x-auto">
        <div className="flex items-stretch min-w-0">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`${tabButtonClass(id)} flex-1 min-w-[100px] py-4 px-4 text-base shrink-0`}
            >
              {TAB_ICONS[id]}
              {t(TAB_KEYS[id])}
            </button>
          ))}
          {adminHasPin && (
            <button type="button" onClick={handleLock} className="shrink-0 px-4 py-4 text-stone-500 hover:text-stone-700 hover:bg-stone-100 text-sm font-medium min-h-[48px] flex items-center gap-1">
              <span>{t('adminLock')}</span> 🔒
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 min-h-[320px] sm:min-h-[420px] overflow-x-hidden">
        {tab === 'products' && <ProductManager />}
        {tab === 'categories' && <CategoryManager />}
        {tab === 'orders' && <OrderList />}
        {tab === 'report' && <ReportSettlement />}
        {tab === 'settings' && <StoreSettings />}
        {tab === 'backup' && <BackupRestore />}
      </div>
    </div>
  );
}
