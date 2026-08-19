import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { startOfDay, endOfDay, isOrderVoided } from '../lib/reportUtils';
import { downloadCSV } from '../lib/csvExport';
import ReceiptModal from './ReceiptModal';

const LOCALE_MAP = { tw: 'zh-TW', kr: 'ko-KR', en: 'en-US' };

function formatDate(iso, lang) {
  const d = new Date(iso);
  return d.toLocaleString(LOCALE_MAP[lang] || 'zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function absoluteImageUrl(image) {
  if (!image) return '';
  try { return new URL(image, window.location.origin).href; } catch { return ''; }
}

function isToday(iso) {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function isThisWeek(iso) {
  const d = new Date(iso);
  const t = new Date();
  const start = new Date(t);
  start.setDate(t.getDate() - t.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

const FILTER_IDS = ['all', 'today', 'week', 'range'];

export default function OrderList() {
  const { orders, refreshOrders, deleteOrder, voidOrder } = useStore();
  const { t, lang } = useLocale();
  const [expandedId, setExpandedId] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (dateFilter === 'today') list = list.filter((o) => isToday(o.createdAt));
    else if (dateFilter === 'week') list = list.filter((o) => isThisWeek(o.createdAt));
    else if (dateFilter === 'range') {
      const start = startOfDay(new Date(rangeStart));
      let end = endOfDay(new Date(rangeEnd));
      if (end < start) end = endOfDay(new Date(rangeStart));
      list = list.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= start.getTime() && t <= end.getTime();
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          String(o.total).includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, dateFilter, rangeStart, rangeEnd, search]);

  const todayOrders = useMemo(
    () => orders.filter((o) => isToday(o.createdAt) && !isOrderVoided(o)),
    [orders]
  );
  const todayTotal = useMemo(() => todayOrders.reduce((s, o) => s + o.total, 0), [todayOrders]);
  const todayCount = todayOrders.length;

  const paymentLabel = (key) => t(key === 'line' ? 'payLine' : key === 'card' ? 'payCard' : 'payCash');
  const exportOrdersCSV = () => {
    const header = [t('time'), t('orderId'), t('amount'), t('paymentMethod'), t('orderStatus')];
    const rows = filteredOrders.map((o) => [
      formatDate(o.createdAt, lang),
      '#' + o.id.slice(0, 8),
      o.total,
      paymentLabel(o.paymentMethod || 'cash'),
      isOrderVoided(o) ? t('orderVoidedBadge') : t('orderStatusNormal'),
    ]);
    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, [header, ...rows]);
  };

  const exportOrdersPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return window.alert(t('pdfPopupBlocked'));
    const orderCards = filteredOrders.map((order) => {
      const items = order.items.map((item) => {
        const image = absoluteImageUrl(item.image);
        return `<div class="item">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}">` : '<div class="image-placeholder">商品</div>'}<div class="item-name">${escapeHtml(item.sku ? `[${item.sku}] ${item.name}` : item.name)} × ${escapeHtml(item.qty)}</div><div class="item-price">NT$ ${Math.round(Number(item.price) * Number(item.qty))}</div></div>`;
      }).join('');
      return `<section class="order ${isOrderVoided(order) ? 'voided' : ''}"><div class="order-head"><div><strong>#${escapeHtml(order.id.slice(0, 8))}</strong><br><span>${escapeHtml(formatDate(order.createdAt, lang))}</span></div><strong>NT$ ${Math.round(Number(order.total))}</strong></div>${items}<div class="meta">${escapeHtml(t('paymentMethod'))}：${escapeHtml(paymentLabel(order.paymentMethod || 'cash'))}${isOrderVoided(order) ? `<br>${escapeHtml(t('orderVoidedBadge'))}` : ''}</div></section>`;
    }).join('');
    printWindow.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(t('orderPdfTitle'))}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;color:#263238;margin:0}h1{font-size:22px;margin:0 0 4px}.summary{color:#64748b;margin:0 0 18px}.order{border:1px solid #cbd5e1;border-radius:12px;padding:12px;margin:0 0 12px;break-inside:avoid}.order-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px}.order-head span,.meta{font-size:12px;color:#64748b}.item{display:grid;grid-template-columns:54px 1fr auto;gap:10px;align-items:center;margin:8px 0}.item img,.image-placeholder{width:54px;height:54px;border-radius:8px;object-fit:cover;background:#f1f5f9}.image-placeholder{display:grid;place-items:center;font-size:11px;color:#94a3b8}.item-name{font-weight:600}.item-price{font-variant-numeric:tabular-nums}.meta{border-top:1px solid #e2e8f0;padding-top:8px;margin-top:8px;line-height:1.6}.voided{opacity:.58}.voided .order-head>strong{text-decoration:line-through}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>${escapeHtml(t('orderPdfTitle'))}</h1><p class="summary">${escapeHtml(t('pdfOrderCount'))}：${filteredOrders.length}</p>${orderCards}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 700);
  };

  return (
    <div>
      {/* 今日摘要 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card-market rounded-2xl p-5">
          <div className="text-sm text-slate-500">{t('todayOrders')}</div>
          <div className="text-2xl font-bold text-slate-800">{todayCount}</div>
        </div>
        <div className="card-market rounded-2xl p-5">
          <div className="text-sm text-slate-500">{t('todayRevenue')}</div>
          <div className="text-2xl font-bold text-slate-800">NT$ {todayTotal}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-3 sm:gap-4 mb-5">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-800">{t('tabOrders')}</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          <button type="button" onClick={exportOrdersCSV} className="px-3 py-2 bg-teal-100 text-slate-800 hover:bg-teal-200 rounded-xl text-sm font-medium min-h-[44px]">
            {t('exportCSV')}
          </button>
          <button type="button" onClick={exportOrdersPDF} className="px-3 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-xl text-sm font-medium min-h-[44px]">
            {t('exportPDF')}
          </button>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white min-h-[44px]"
          >
            <option value="all">{t('filterAll')}</option>
            <option value="today">{t('filterToday')}</option>
            <option value="week">{t('filterWeek')}</option>
            <option value="range">{t('rangeSettle')}</option>
          </select>
          {dateFilter === 'range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
              <span className="text-slate-400">~</span>
              <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchOrderPlaceholder')}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm w-full min-w-0 sm:w-56 min-h-[44px]"
          />
          <button
            type="button"
            onClick={refreshOrders}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-sm font-medium"
          >
            {t('refresh')}
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-500 mb-1">{orders.length === 0 ? t('emptyOrdersHint') : t('noOrders')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="card-market rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                className={`w-full flex justify-between items-center p-4 text-left ${
                  isOrderVoided(order) ? 'bg-slate-100/90 opacity-90' : 'bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-mono text-slate-500 text-sm">#{order.id.slice(0, 8)}</span>
                  {isOrderVoided(order) && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">{t('orderVoidedBadge')}</span>
                  )}
                  <span className="text-slate-600">{formatDate(order.createdAt, lang)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold tabular-nums ${isOrderVoided(order) ? 'text-slate-500 line-through' : 'text-slate-800'}`}>NT$ {order.total}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReceiptOrder(order);
                    }}
                    className="px-3 py-1.5 text-sm bg-teal-100 text-slate-800 rounded-lg hover:bg-teal-200 shrink-0"
                  >
                    {t('receipt')}
                  </button>
                </div>
              </button>
              {expandedId === order.id && (
                <div className="p-4 border-t border-slate-200 bg-white">
                  <ul className="space-y-2">
                    {order.items.map((item, i) => (
                      <li key={i} className="flex justify-between items-center gap-3 text-slate-700">
                        <span className="flex items-center gap-3 min-w-0">
                          {item.image ? <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0" /> : <span className="w-14 h-14 rounded-lg bg-slate-100 text-slate-400 text-xs grid place-items-center shrink-0">{t('image')}</span>}
                          <span>{item.sku ? `[${item.sku}] ` : ''}{item.name} × {item.qty}</span>
                        </span>
                        <span className="shrink-0">NT$ {item.price * item.qty}</span>
                      </li>
                    ))}
                  </ul>
                  {order.paymentMethod && (
                    <div className="mt-2 text-sm text-slate-600">
                      {t('paymentMethod')}：{t(order.paymentMethod === 'line' ? 'payLine' : order.paymentMethod === 'card' ? 'payCard' : 'payCash')}
                    </div>
                  )}
                  {isOrderVoided(order) && order.voidReason && (
                    <div className="mt-2 text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                      {t('voidReasonLabel')}：{order.voidReason}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    {!isOrderVoided(order) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setVoidTarget(order);
                            setVoidReason('');
                          }}
                          className="px-3 py-1.5 text-sm bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 font-medium"
                        >
                          {t('voidOrderBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('confirmDeleteOrderPermanent'))) {
                              deleteOrder(order.id);
                              setExpandedId(null);
                            }
                          }}
                          className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        >
                          {t('deleteOrderPermanently')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('confirmDeleteOrder'))) {
                            deleteOrder(order.id);
                            setExpandedId(null);
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                      >
                        {t('deleteRecord')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45" onClick={() => setVoidTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3 className="text-lg font-semibold text-slate-800">{t('voidOrderTitle')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('voidOrderHint')}</p>
            <p className="text-sm font-mono text-slate-600 mt-3">#{voidTarget.id.slice(0, 8)} · NT$ {voidTarget.total}</p>
            <label className="block text-xs text-slate-600 mt-4 mb-1">{t('voidReasonLabel')}</label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder={t('voidReasonPlaceholder')}
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm min-h-[80px]"
            />
            <div className="flex gap-3 mt-5">
              <button type="button" className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-medium" onClick={() => setVoidTarget(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700"
                onClick={() => {
                  voidOrder(voidTarget.id, voidReason);
                  setVoidTarget(null);
                  setVoidReason('');
                  setExpandedId(null);
                }}
              >
                {t('confirmVoid')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
