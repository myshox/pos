import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { getAdminDashboardStats } from '../lib/adminStats';

function paymentLabel(t, key) {
  return key === 'line' ? t('payLine') : key === 'card' ? t('payCard') : t('payCash');
}

export default function AdminDashboard({ onNavigateToTab }) {
  const { orders, products } = useStore();
  const { t } = useLocale();

  const stats = useMemo(() => getAdminDashboardStats(orders, products), [orders, products]);

  const maxBar = Math.max(1, ...stats.last7Days.map((d) => d.total));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t('adminDashboardTitle')}</h2>
        <p className="text-sm text-slate-500 mt-1">{t('adminDashboardSubtitle')}</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('todayRevenue')}</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">NT$ {stats.today.total}</div>
          <div className="text-xs text-slate-400 mt-2">{t('ordersCount')} {stats.today.count}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('avgTicket')}</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">NT$ {stats.today.avgTicket}</div>
          <div className="text-xs text-slate-400 mt-2">{t('dashboardTodayHint')}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('yesterdayCompare')}</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">NT$ {stats.yesterday.total}</div>
          <div className="text-xs text-slate-400 mt-2">{stats.yesterday.count} {t('ordersCount')}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('weekSummary')}</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">NT$ {stats.week.total}</div>
          <div className="text-xs text-slate-400 mt-2">{stats.week.count} {t('ordersCount')}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 近 7 日營收 */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">{t('chartLast7Days')}</h3>
          <div className="flex items-end gap-2 h-40">
            {stats.last7Days.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div
                  className="w-full max-w-[48px] mx-auto rounded-t bg-teal-500/90 hover:bg-teal-500 transition min-h-[4px]"
                  style={{ height: `${Math.max(4, (d.total / maxBar) * 100)}%` }}
                  title={`NT$ ${d.total}`}
                />
                <span className="text-[10px] sm:text-xs text-slate-500 truncate w-full text-center">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 今日付款占比 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">{t('paymentSplitToday')}</h3>
          <ul className="space-y-3">
            {['line', 'cash', 'card'].map((key) => {
              const p = stats.paymentToday[key];
              const sum = stats.today.total || 1;
              const pct = Math.round((p.total / sum) * 100) || 0;
              return (
                <li key={key}>
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>{paymentLabel(t, key)}</span>
                    <span className="tabular-nums">NT$ {p.total} ({p.count})</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 今日熱銷 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-800">{t('topSellingToday')}</h3>
            <button type="button" onClick={() => onNavigateToTab?.('products')} className="text-xs text-teal-600 font-medium hover:underline">
              {t('tabProducts')} →
            </button>
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-slate-400">{t('noSalesToday')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.topProducts.map((row, i) => (
                <li key={row.id ?? row.name} className="flex justify-between py-2.5 text-sm first:pt-0">
                  <span className="text-slate-700 truncate pr-2">
                    <span className="text-slate-400 font-mono text-xs mr-2">{i + 1}</span>
                    {row.name}
                  </span>
                  <span className="text-slate-900 font-medium tabular-nums shrink-0">NT$ {row.revenue}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 庫存警示 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-800">{t('stockAlerts')}</h3>
            <button type="button" onClick={() => onNavigateToTab?.('inventory')} className="text-xs text-teal-600 font-medium hover:underline">
              {t('tabInventory')} →
            </button>
          </div>
          {(stats.lowStock.length === 0 && stats.outOfStock.length === 0) ? (
            <p className="text-sm text-slate-500">{t('stockAllOk')}</p>
          ) : (
            <ul className="space-y-2">
              {stats.outOfStock.map((p) => (
                <li key={p.id} className="flex justify-between text-sm rounded-lg bg-red-50 text-red-800 px-3 py-2">
                  <span className="truncate">{p.name}</span>
                  <span className="font-semibold shrink-0">{t('outOfStock')}</span>
                </li>
              ))}
              {stats.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between text-sm rounded-lg bg-amber-50 text-amber-900 px-3 py-2">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums shrink-0">{t('stockQty')}: {p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 最近訂單 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-slate-800">{t('recentOrders')}</h3>
          <div className="text-xs text-slate-500">
            {t('voidedOrdersTotal')}: {stats.voidCount}
          </div>
        </div>
        {stats.recentOrders.length === 0 ? (
          <p className="text-sm text-slate-400">{t('emptyOrdersHint')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stats.recentOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="font-mono text-slate-500">#{String(o.id).slice(0, 8)}</span>
                <span className="text-slate-600">{new Date(o.createdAt).toLocaleString()}</span>
                <span className="font-semibold text-slate-900 tabular-nums">NT$ {o.total}</span>
                <span className="text-slate-500">{paymentLabel(t, o.paymentMethod || 'cash')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
