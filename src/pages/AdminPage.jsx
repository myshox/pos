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

export default function AdminPage() {
  const [tab, setTab] = useState('products');
  const { t } = useLocale();
  const { adminHasPin, adminLock } = useStore();
  const navigate = useNavigate();

  const handleLock = () => {
    adminLock();
    navigate('/');
  };

  return (
    <div className="card-market rounded-2xl overflow-hidden w-full">
      <div className="border-b border-stone-200 overflow-x-auto overflow-y-hidden flex items-stretch">
        <div className="flex min-w-0 sm:flex-wrap">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 min-w-[72px] sm:min-w-[100px] py-3 sm:py-4 px-3 sm:px-4 font-medium transition text-xs sm:text-base shrink-0 min-h-[48px] ${
                tab === id ? 'bg-stone-800 text-amber-50' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t(TAB_KEYS[id])}
            </button>
          ))}
          {adminHasPin && (
            <button type="button" onClick={handleLock} className="shrink-0 px-3 sm:px-4 py-3 sm:py-4 text-stone-500 hover:text-stone-700 hover:bg-stone-100 text-xs sm:text-sm font-medium min-h-[48px] flex items-center gap-1">
              <span className="hidden sm:inline">{t('adminLock')}</span> 🔒
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
