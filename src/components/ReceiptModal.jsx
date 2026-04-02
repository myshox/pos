import React, { useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';

const LOCALE_MAP = { tw: 'zh-TW', kr: 'ko-KR', en: 'en-US' };

function formatReceiptDate(iso, lang) {
  return new Date(iso).toLocaleString(LOCALE_MAP[lang] || 'zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function ReceiptModal({ order, onClose }) {
  const blockRef = useRef(null);
  const { store } = useStore();
  const { t, lang } = useLocale();
  const { showToast } = useToast();

  const copyReceipt = () => {
    if (!blockRef.current) return;
    const text = blockRef.current.innerText;
    navigator.clipboard?.writeText(text).then(() => showToast(t('copied'))).catch(() => { /* clipboard not available */ });
  };

  const printReceipt = () => {
    if (!blockRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<pre style="font-family: var(--font-cute), sans-serif; padding: 24px; font-size: 14px;">${blockRef.current.innerText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
    win.document.close();
    win.print();
    win.close();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'var(--font-cute)' }}
      >
        <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">{t('receiptTitle')}</h3>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={copyReceipt} className="px-3 py-2 sm:py-1.5 text-sm bg-teal-100 text-slate-800 rounded-lg hover:bg-teal-200 min-h-[44px] sm:min-h-0">
              {t('copy')}
            </button>
            <button type="button" onClick={printReceipt} className="px-3 py-2 sm:py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 min-h-[44px] sm:min-h-0">
              {t('printReceipt')}
            </button>
            <button type="button" onClick={onClose} className="px-3 py-2 sm:py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 min-h-[44px] sm:min-h-0">
              {t('close')}
            </button>
          </div>
        </div>
        <div ref={blockRef} className="p-6 overflow-y-auto text-sm text-slate-700 space-y-1">
          <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
            <div className="font-semibold text-slate-800">{store.name || t('appName')}</div>
            {store.phone && <div className="text-slate-600 text-xs mt-0.5">{store.phone}</div>}
            {store.address && <div className="text-slate-500 text-xs">{store.address}</div>}
            <div className="text-slate-500 text-xs mt-1">{t('orderLabel')} #{order.id.slice(0, 8)}</div>
            <div className="text-slate-500 text-xs">{formatReceiptDate(order.createdAt, lang)}</div>
            {store.taxId && <div className="text-slate-600 text-xs mt-0.5">{t('storeTaxId')}：{store.taxId}</div>}
          </div>
          {order.items.map((item, i) => {
            const line = Number(item.price) * Number(item.qty);
            const lineAmt = Number.isFinite(line) ? Math.round(line * 100) / 100 : 0;
            return (
              <div key={i} className="flex justify-between gap-2 tabular-nums">
                <span className="min-w-0 break-words">{item.sku ? `[${item.sku}] ` : ''}{item.name} × {item.qty}</span>
                <span className="shrink-0">NT$ {lineAmt}</span>
              </div>
            );
          })}
          {order.note && (
            <div className="pt-2 text-slate-800/90 text-xs">{t('note')}：{order.note}</div>
          )}
          {order.paymentMethod && (
            <div className="pt-1 text-slate-600 text-xs">
              {t('paymentMethod')}：{t(order.paymentMethod === 'line' ? 'payLine' : order.paymentMethod === 'card' ? 'payCard' : 'payCash')}
            </div>
          )}
          <div className="flex justify-between font-semibold pt-3 border-t border-slate-300 mt-3 tabular-nums">
            <span>{t('totalLabel')}</span>
            <span>NT$ {Number.isFinite(Number(order.total)) ? order.total : 0}</span>
          </div>
          {order.cashReceived != null && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>{t('cashReceived')}</span>
                <span>NT$ {order.cashReceived}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-emerald-700">
                <span>{t('changeAmount')}</span>
                <span>NT$ {order.changeAmount}</span>
              </div>
            </div>
          )}
          <div className="text-center text-slate-500 text-xs pt-5 border-t border-dashed border-slate-200 mt-3">{t('thanksVisit')}</div>
        </div>
      </div>
    </div>
  );
}
