import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';

export default function InventoryPanel() {
  const { products, updateProduct } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  const stockProducts = useMemo(
    () => products.filter((p) => p.useStock).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [products]
  );

  const saveStock = (id, raw) => {
    const n = Math.max(0, Math.floor(Number(raw)));
    if (Number.isNaN(n)) {
      showToast(t('invalidNumber'), 'error');
      return;
    }
    updateProduct(id, { stock: n });
    showToast(t('toastSaved'));
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t('tabInventory')}</h2>
        <p className="text-sm text-slate-500 mt-1">{t('inventoryHint')}</p>
      </div>

      {stockProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-slate-500 text-sm">
          {t('inventoryNoStockProducts')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">{t('productName')}</th>
                <th className="px-4 py-3 font-semibold">{t('category')}</th>
                <th className="px-4 py-3 font-semibold w-32">{t('productStock')}</th>
                <th className="px-4 py-3 font-semibold w-40">{t('status')}</th>
                <th className="px-4 py-3 w-36" />
              </tr>
            </thead>
            <tbody>
              {stockProducts.map((p) => {
                const low = typeof p.stock === 'number' && p.stock > 0 && p.stock <= 5;
                const out = typeof p.stock === 'number' && p.stock === 0;
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.category || '—'}</td>
                    <td className="px-4 py-3">
                      {editingId === p.id ? (
                        <input
                          type="number"
                          min={0}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-base min-h-[40px]"
                          autoFocus
                        />
                      ) : (
                        <span className="tabular-nums font-semibold text-slate-900">{p.stock ?? 0}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {out && <span className="inline-flex px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-xs font-medium">{t('outOfStock')}</span>}
                      {!out && low && <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-medium">{t('lowStock')}</span>}
                      {!out && !low && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === p.id ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-xs font-medium"
                            onClick={() => setEditingId(null)}
                          >
                            {t('cancel')}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium"
                            onClick={() => saveStock(p.id, draft)}
                          >
                            {t('save')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-teal-600 font-medium text-xs hover:underline"
                          onClick={() => {
                            setEditingId(p.id);
                            setDraft(String(p.stock ?? 0));
                          }}
                        >
                          {t('adjustStock')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
