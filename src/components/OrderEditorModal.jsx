import React, { useMemo, useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';

const COPY = {
  tw: { time: '訂單時間', items: '訂單品項', addItem: '新增品項', remove: '移除', name: '商品名稱', qty: '數量', unitPrice: '單價', provider: '刷卡管道', totalHint: '修改品項後會自動重算總額' },
  kr: { time: '주문 시간', items: '주문 항목', addItem: '항목 추가', remove: '삭제', name: '상품명', qty: '수량', unitPrice: '단가', provider: '카드 결제 수단', totalHint: '항목 수정 시 합계가 자동 계산됩니다' },
  en: { time: 'Order time', items: 'Order items', addItem: 'Add item', remove: 'Remove', name: 'Product name', qty: 'Qty', unitPrice: 'Unit price', provider: 'Card channel', totalHint: 'The total updates when items change' },
};

function toLocalDateTime(iso) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function OrderEditorModal({ order, onClose, onSave }) {
  const { t, lang } = useLocale();
  const { showToast } = useToast();
  const copy = COPY[lang] || COPY.tw;
  const [createdAt, setCreatedAt] = useState(() => toLocalDateTime(order.createdAt));
  const [items, setItems] = useState(() => (order.items || []).map((item) => ({ ...item })));
  const [total, setTotal] = useState(String(order.total ?? 0));
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || 'cash');
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus || 'paid');
  const [cardProvider, setCardProvider] = useState(order.cardProvider || 'terminal');
  const [note, setNote] = useState(order.note || '');

  const calculatedTotal = useMemo(() => items.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(Number(item.qty) || 0)) * Math.max(0, Math.round(Number(item.price) || 0)),
    0
  ), [items]);

  const updateItem = (index, key, value) => {
    const next = items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item);
    setItems(next);
    if (key === 'qty' || key === 'price') {
      setTotal(String(next.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.qty) || 0)) * Math.max(0, Math.round(Number(item.price) || 0)), 0)));
    }
  };

  const removeItem = (index) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    setItems(next);
    setTotal(String(next.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.qty) || 0)) * Math.max(0, Math.round(Number(item.price) || 0)), 0)));
  };

  const submit = (event) => {
    event.preventDefault();
    const normalizedItems = items.map((item) => ({
      ...item,
      name: String(item.name || '').trim(),
      sku: String(item.sku || '').trim(),
      qty: Math.max(1, Math.floor(Number(item.qty) || 1)),
      price: Math.max(0, Math.round(Number(item.price) || 0)),
    })).filter((item) => item.name);
    const normalizedTotal = Math.round(Number(total));
    if (!createdAt || normalizedItems.length === 0 || !Number.isFinite(normalizedTotal) || normalizedTotal < 0) {
      showToast(t('validationPrice'), 'error');
      return;
    }
    onSave({
      createdAt: new Date(createdAt).toISOString(),
      items: normalizedItems,
      subtotal: normalizedTotal,
      total: normalizedTotal,
      paymentMethod,
      paymentStatus: paymentMethod === 'atm' ? paymentStatus : 'paid',
      cardProvider: paymentMethod === 'card' ? cardProvider : '',
      note: note.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-black/45" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="edit-order-title">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div><h3 id="edit-order-title" className="text-lg font-semibold text-slate-800">{t('editOrderTitle')} #{order.id.slice(0, 8)}</h3><p className="text-sm text-slate-500 mt-1">{copy.totalHint}</p></div>
          <button type="button" onClick={onClose} className="min-h-[44px] px-3 rounded-xl bg-slate-100 text-slate-700">{t('cancel')}</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block"><span className="text-sm font-medium text-slate-600">{copy.time}</span><input type="datetime-local" value={createdAt} onChange={(event) => setCreatedAt(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base" required /></label>
          <label className="block"><span className="text-sm font-medium text-slate-600">{t('paymentMethod')}</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base"><option value="cash">{t('payCash')}</option><option value="line">{t('payLine')}</option><option value="card">{t('payCard')}</option><option value="atm">{t('payAtm')}</option><option value="aftee">{t('payAftee')}</option></select></label>
          {paymentMethod === 'card' && <label className="block"><span className="text-sm font-medium text-slate-600">{copy.provider}</span><select value={cardProvider} onChange={(event) => setCardProvider(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base"><option value="terminal">{lang === 'en' ? 'Card terminal' : lang === 'kr' ? '카드 단말기' : '現場刷卡機'}</option><option value="tappay">TapPay</option></select></label>}
          {paymentMethod === 'atm' && <label className="block"><span className="text-sm font-medium text-slate-600">ATM 入帳狀態</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base"><option value="pending">待轉帳</option><option value="paid">已入帳</option></select></label>}
          <label className="block"><span className="text-sm font-medium text-slate-600">{t('amount')}</span><input type="number" min="0" step="1" value={total} onChange={(event) => setTotal(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base tabular-nums" required /><small className="text-slate-500">{copy.items}: NT$ {calculatedTotal}</small></label>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-2"><h4 className="font-semibold text-slate-700">{copy.items}</h4><button type="button" onClick={() => setItems((current) => [...current, { name: '', sku: '', qty: 1, price: 0 }])} className="min-h-[40px] px-3 rounded-xl bg-teal-50 text-teal-800 font-medium">{copy.addItem}</button></div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`${item.id || 'item'}-${index}`} className="grid grid-cols-12 gap-2 items-end rounded-xl bg-slate-50 p-3">
                <label className="col-span-12 sm:col-span-5"><span className="text-xs text-slate-600">{copy.name}</span><input value={item.name || ''} onChange={(event) => updateItem(index, 'name', event.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-base" required /></label>
                <label className="col-span-5 sm:col-span-2"><span className="text-xs text-slate-600">SKU</span><input value={item.sku || ''} onChange={(event) => updateItem(index, 'sku', event.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-base" /></label>
                <label className="col-span-3 sm:col-span-2"><span className="text-xs text-slate-600">{copy.qty}</span><input type="number" min="1" step="1" value={item.qty} onChange={(event) => updateItem(index, 'qty', event.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-base" /></label>
                <label className="col-span-4 sm:col-span-2"><span className="text-xs text-slate-600">{copy.unitPrice}</span><input type="number" min="0" step="1" value={item.price} onChange={(event) => updateItem(index, 'price', event.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-base" /></label>
                <button type="button" disabled={items.length === 1} onClick={() => removeItem(index)} className="col-span-12 sm:col-span-1 min-h-[40px] rounded-lg text-red-700 bg-red-50 disabled:opacity-40">{copy.remove}</button>
              </div>
            ))}
          </div>
        </div>

        <label className="block mt-5"><span className="text-sm font-medium text-slate-600">{t('orderNote')}</span><textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base" /></label>
        <button type="submit" className="btn-primary w-full min-h-[48px] rounded-xl font-semibold mt-6">{t('save')}</button>
      </form>
    </div>
  );
}
