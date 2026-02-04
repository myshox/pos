import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';

export default function StoreSettings() {
  const { store, updateStore } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', phone: '', address: '', taxId: '' });

  useEffect(() => {
    setForm({
      name: store.name || '',
      phone: store.phone || '',
      address: store.address || '',
      taxId: store.taxId || '',
    });
  }, [store]);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateStore({
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      taxId: form.taxId.trim(),
    });
    showToast(t('save'));
  };

  const handlePinDisabledChange = (e) => {
    const checked = e.target.checked;
    updateStore({ pinDisabled: checked });
    showToast(checked ? t('pinDisabledLabel') + ' ✓' : t('save'));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-stone-800">{t('storeSettingsTitle')}</h2>
      <p className="text-stone-600 text-sm">{t('storeSettingsHint')}</p>

      {/* 暫時關閉 PIN：即時生效 */}
      <div className="card-market rounded-2xl p-5 sm:p-6 max-w-xl">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!store.pinDisabled}
            onChange={handlePinDisabledChange}
            className="mt-1 w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          <div>
            <span className="font-medium text-stone-800">{t('pinDisabledLabel')}</span>
            <p className="text-stone-500 text-sm mt-0.5">{t('pinDisabledHint')}</p>
          </div>
        </label>
      </div>

      <form onSubmit={handleSubmit} className="card-market rounded-2xl p-5 sm:p-6 space-y-4 max-w-xl">
        <label className="block">
          <span className="text-sm font-medium text-stone-600">{t('storeName')}</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('storeNamePlaceholder')}
            className="mt-1 w-full border border-stone-300 rounded-xl px-3 py-2.5 min-h-[44px]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-600">{t('storePhone')}</span>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={t('storePhonePlaceholder')}
            className="mt-1 w-full border border-stone-300 rounded-xl px-3 py-2.5 min-h-[44px]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-600">{t('storeAddress')}</span>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder={t('storeAddressPlaceholder')}
            className="mt-1 w-full border border-stone-300 rounded-xl px-3 py-2.5 min-h-[44px]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-600">{t('storeTaxId')}</span>
          <input
            type="text"
            value={form.taxId}
            onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
            placeholder={t('storeTaxIdPlaceholder')}
            className="mt-1 w-full border border-stone-300 rounded-xl px-3 py-2.5 min-h-[44px]"
          />
        </label>
        <button type="submit" className="btn-primary px-5 py-2.5 rounded-xl font-medium min-h-[44px]">
          {t('save')}
        </button>
      </form>
    </div>
  );
}
