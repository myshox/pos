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

function formatDiscount(order, t) {
  if (!order.discount || (order.discount.type !== 'amount' && order.discount.type !== 'percent')) return null;
  const v = order.discount.value;
  return order.discount.type === 'percent' ? `${v}% ${t('discountPercent')}` : `NT$ ${v}`;
}

export default function ReceiptModal({ order, onClose }) {
  const blockRef = useRef(null);
  const { store } = useStore();
  const { t, lang } = useLocale();
  const { showToast } = useToast();

  const copyReceipt = () => {
    if (!blockRef.current) return;
    const text = blockRef.current.innerText;
    navigator.clipboard?.writeText(text).then(() => showToast(t('copied')));
  };

  const printReceipt = () => {
    if (!blockRef.current) return;
    const win = window.open('', '_blank');
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
        <div className="p-4 sm:p-6 border-b border-stone-200 flex justify-between items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-stone-800">{t('receiptTitle')}</h3>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={copyReceipt} className="px-3 py-2 sm:py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 min-h-[44px] sm:min-h-0">
              {t('copy')}
            </button>
            <button type="button" onClick={printReceipt} className="px-3 py-2 sm:py-1.5 text-sm bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 min-h-[44px] sm:min-h-0">
              {t('printReceipt')}
            </button>
            <button type="button" onClick={onClose} className="px-3 py-2 sm:py-1.5 text-sm bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300 min-h-[44px] sm:min-h-0">
              {t('close')}
            </button>
          </div>
        </div>
        <div ref={blockRef} className="p-6 overflow-y-auto text-sm text-stone-700 space-y-1">
          <div className="text-center border-b border-dashed border-stone-300 pb-3 mb-3">
            <div className="font-semibold text-stone-800">{store.name || t('appName')}</div>
            {store.phone && <div className="text-stone-600 text-xs mt-0.5">{store.phone}</div>}
            {store.address && <div className="text-stone-500 text-xs">{store.address}</div>}
            <div className="text-stone-500 text-xs mt-1">{t('orderLabel')} #{order.id.slice(0, 8)}</div>
            <div className="text-stone-500 text-xs">{formatReceiptDate(order.createdAt, lang)}</div>
            {store.taxId && <div className="text-stone-600 text-xs mt-0.5">{t('storeTaxId')}：{store.taxId}</div>}
          </div>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>{item.sku ? `[${item.sku}] ` : ''}{item.name} × {item.qty}</span>
              <span>NT$ {item.price * item.qty}</span>
            </div>
          ))}
          {order.note && (
            <div className="pt-2 text-amber-800/90 text-xs">{t('note')}：{order.note}</div>
          )}
          {order.subtotal != null && order.subtotal !== order.total && (
            <div className="flex justify-between text-stone-600 text-xs pt-1">
              <span>{t('subtotal')}</span>
              <span>NT$ {order.subtotal}</span>
            </div>
          )}
          {order.discount && (order.discount.type === 'amount' || order.discount.type === 'percent') && (
            <div className="flex justify-between text-amber-700 text-xs">
              <span>{t('discount')}（{formatDiscount(order, t)}）</span>
              <span>- NT$ {(order.subtotal ?? order.total) - order.total}</span>
            </div>
          )}
          {order.paymentMethod && (
            <div className="pt-1 text-stone-600 text-xs">
              {t('paymentMethod')}：{t(order.paymentMethod === 'line' ? 'payLine' : order.paymentMethod === 'card' ? 'payCard' : 'payCash')}
            </div>
          )}
          <div className="flex justify-between font-semibold pt-3 border-t border-stone-300 mt-3">
            <span>{t('totalLabel')}</span>
            <span>NT$ {order.total}</span>
          </div>
          <div className="text-center text-stone-500 text-xs pt-5 border-t border-dashed border-stone-200 mt-3">{t('thanksVisit')}</div>
        </div>
      </div>
    </div>
  );
}
