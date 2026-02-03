import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { startOfDay, endOfDay } from '../lib/reportUtils';
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
  const { orders, refreshOrders } = useStore();
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

  const todayOrders = useMemo(() => orders.filter((o) => isToday(o.createdAt)), [orders]);
  const todayTotal = useMemo(() => todayOrders.reduce((s, o) => s + o.total, 0), [todayOrders]);
  const todayCount = todayOrders.length;

  const paymentLabel = (key) => t(key === 'line' ? 'payLine' : key === 'card' ? 'payCard' : 'payCash');
  const exportOrdersCSV = () => {
    const header = [t('time'), t('orderId'), t('amount'), t('paymentMethod'), t('note')];
    const rows = filteredOrders.map((o) => [
      formatDate(o.createdAt, lang),
      '#' + o.id.slice(0, 8),
      o.total,
      paymentLabel(o.paymentMethod || 'cash'),
      (o.note || '').replace(/\r?\n/g, ' '),
    ]);
    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, [header, ...rows]);
  };

  return (
    <div>
      {/* 今日摘要 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card-market rounded-2xl p-5">
          <div className="text-sm text-stone-500">{t('todayOrders')}</div>
          <div className="text-2xl font-bold text-stone-800">{todayCount}</div>
        </div>
        <div className="card-market rounded-2xl p-5">
          <div className="text-sm text-stone-500">{t('todayRevenue')}</div>
          <div className="text-2xl font-bold text-amber-800">NT$ {todayTotal}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-3 sm:gap-4 mb-5">
        <h2 className="text-lg sm:text-xl font-semibold text-stone-800">{t('tabOrders')}</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          <button type="button" onClick={exportOrdersCSV} className="px-3 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-xl text-sm font-medium min-h-[44px]">
            {t('exportCSV')}
          </button>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white min-h-[44px]"
          >
            <option value="all">{t('filterAll')}</option>
            <option value="today">{t('filterToday')}</option>
            <option value="week">{t('filterWeek')}</option>
            <option value="range">{t('rangeSettle')}</option>
          </select>
          {dateFilter === 'range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
              <span className="text-stone-400">~</span>
              <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchOrderPlaceholder')}
            className="border border-stone-300 rounded-xl px-3 py-2 text-sm w-full min-w-0 sm:w-56 min-h-[44px]"
          />
          <button
            type="button"
            onClick={refreshOrders}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-xl text-sm font-medium"
          >
            {t('refresh')}
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-stone-500 mb-1">{orders.length === 0 ? t('emptyOrdersHint') : t('noOrders')}</p>
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
                className="w-full flex justify-between items-center p-4 bg-stone-50/60 hover:bg-stone-50 text-left"
              >
                <div className="flex gap-4 items-center">
                  <span className="font-mono text-stone-500 text-sm">#{order.id.slice(0, 8)}</span>
                  <span className="text-stone-600">{formatDate(order.createdAt, lang)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-amber-800">NT$ {order.total}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReceiptOrder(order);
                    }}
                    className="px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200"
                  >
                    {t('receipt')}
                  </button>
                </div>
              </button>
              {expandedId === order.id && (
                <div className="p-4 border-t border-stone-200 bg-white">
                  <ul className="space-y-2">
                    {order.items.map((item, i) => (
                      <li key={i} className="flex justify-between text-stone-700">
                        <span>{item.name} × {item.qty}</span>
                        <span>NT$ {item.price * item.qty}</span>
                      </li>
                    ))}
                  </ul>
                  {order.note && (
                    <div className="mt-2 text-sm text-amber-800/90">{t('note')}：{order.note}</div>
                  )}
                  {order.paymentMethod && (
                    <div className="mt-2 text-sm text-stone-600">
                      {t('paymentMethod')}：{t(order.paymentMethod === 'line' ? 'payLine' : order.paymentMethod === 'card' ? 'payCard' : 'payCash')}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-stone-100 flex justify-end">
                    <span className="font-bold text-stone-800">{t('total')} NT$ {order.total}</span>
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
    </div>
  );
}
