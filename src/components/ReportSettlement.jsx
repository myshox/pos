import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import ReceiptModal from './ReceiptModal';
import {
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getOrdersInRange,
  startOfDay,
  endOfDay,
  getWeekOptions,
  getMonthOptions,
  formatReportDate,
  getPaymentBreakdown,
  getProductAnalysis,
} from '../lib/reportUtils';
import { downloadCSV } from '../lib/csvExport';
import CategoryRevenueChart from './CategoryRevenueChart';

const PERIOD_IDS = ['day', 'week', 'month', 'range'];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function paymentLabel(t, key) {
  return key === 'line' ? t('payLine') : key === 'card' ? t('payCard') : t('payCash');
}

export default function ReportSettlement() {
  const { orders, refreshOrders, updateOrder, deleteOrder } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [period, setPeriod] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toDateStr(d);
  });
  const [rangeEnd, setRangeEnd] = useState(() => toDateStr(new Date()));
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [editOrder, setEditOrder] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [editTotal, setEditTotal] = useState('');
  const [editPayment, setEditPayment] = useState('cash');

  const weekOptions = useMemo(() => getWeekOptions(16), []);
  const monthOptions = useMemo(() => getMonthOptions(16), []);

  const report = useMemo(() => {
    if (period === 'day') {
      return getDailyReport(orders, new Date(selectedDate));
    }
    if (period === 'week') {
      const weekStart = weekOptions[selectedWeekIndex]?.date;
      if (!weekStart) return { orders: [], count: 0, total: 0 };
      return getWeeklyReport(orders, weekStart);
    }
    if (period === 'range') {
      const start = startOfDay(new Date(rangeStart));
      let end = endOfDay(new Date(rangeEnd));
      if (end < start) end = endOfDay(new Date(rangeStart));
      return getOrdersInRange(orders, start, end);
    }
    const m = monthOptions[selectedMonthIndex];
    if (!m) return { orders: [], count: 0, total: 0 };
    return getMonthlyReport(orders, m.year, m.month);
  }, [orders, period, selectedDate, selectedWeekIndex, selectedMonthIndex, rangeStart, rangeEnd, weekOptions, monthOptions]);

  const paymentBreakdown = useMemo(() => getPaymentBreakdown(report.orders), [report.orders]);
  const productAnalysis = useMemo(() => getProductAnalysis(report.orders), [report.orders]);
  const periodLabel = useMemo(() => {
    if (period === 'day') return `${selectedDate} ${t('daySettle')}`;
    if (period === 'week') return weekOptions[selectedWeekIndex] ? `${t('weekSettle')} ${weekOptions[selectedWeekIndex].label}` : t('weekSettle');
    if (period === 'range') return `${rangeStart} ~ ${rangeEnd}`;
    return monthOptions[selectedMonthIndex] ? monthOptions[selectedMonthIndex].label + ' ' + t('monthSettle') : t('monthSettle');
  }, [period, selectedDate, selectedWeekIndex, selectedMonthIndex, rangeStart, rangeEnd, weekOptions, monthOptions, t]);

  const openEdit = (order) => {
    setEditOrder(order);
    setEditNote(order.note || '');
    setEditTotal(String(order.total));
    setEditPayment(order.paymentMethod || 'cash');
  };

  const closeEdit = () => {
    setEditOrder(null);
    setEditNote('');
    setEditTotal('');
    setEditPayment('cash');
  };

  const saveEdit = () => {
    if (!editOrder) return;
    const totalNum = Math.round(parseFloat(editTotal));
    if (Number.isNaN(totalNum) || totalNum < 0) {
      showToast(t('validationPrice'), 'error');
      return;
    }
    updateOrder(editOrder.id, {
      note: editNote.trim(),
      total: totalNum,
      paymentMethod: editPayment,
    });
    showToast(t('save'));
    closeEdit();
  };

  const handleDelete = (order) => {
    if (!window.confirm(t('confirmDeleteOrder'))) return;
    deleteOrder(order.id);
    showToast(t('delete'));
  };

  const exportReportCSV = () => {
    const header = [t('time'), t('orderId'), t('amount'), t('paymentMethod')];
    const rows = report.orders.map((o) => [
      formatReportDate(o.createdAt),
      '#' + o.id.slice(0, 8),
      o.total,
      paymentLabel(t, o.paymentMethod || 'cash'),
    ]);
    const summary = ['', t('orderCount') + ' ' + report.count, 'NT$ ' + report.total, ''];
    const filename = `report-${period === 'day' ? selectedDate : period === 'range' ? `${rangeStart}-${rangeEnd}` : 'export'}.csv`;
    downloadCSV(filename, [header, ...rows, [], summary]);
    showToast(t('backupExportSuccess'));
  };

  const printDaySettlement = () => {
    const dayReport = period === 'day' ? report : getDailyReport(orders, new Date(selectedDate));
    const dateLabel = period === 'day' ? selectedDate : toDateStr(new Date());
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('daySettlementTitle')} ${dateLabel}</title>
      <style>body{font-family:sans-serif;padding:24px;max-width:600px;margin:0 auto} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:8px;text-align:left} th{background:#f5f5f5}</style>
      </head><body>
      <h1>${t('daySettlementTitle')} ${dateLabel}</h1>
      <p><strong>${t('orderCount')}</strong> ${dayReport.count} &nbsp; <strong>${t('revenue')}</strong> NT$ ${dayReport.total.toLocaleString()}</p>
      <table><thead><tr><th>${t('time')}</th><th>${t('orderId')}</th><th>${t('amount')}</th></tr></thead><tbody>
      ${dayReport.orders.map((o) => `<tr><td>${formatReportDate(o.createdAt)}</td><td>#${o.id.slice(0, 8)}</td><td>NT$ ${o.total}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:24px;color:#666;font-size:12px">${new Date().toLocaleString()}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
    win.close();
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl font-semibold text-stone-800">{t('reportTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportReportCSV} className="px-4 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-xl text-sm font-medium min-h-[44px]">
            {t('exportCSV')}
          </button>
          {period === 'day' && (
            <button type="button" onClick={printDaySettlement} className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-xl text-sm font-medium min-h-[44px]">
              {t('daySettlementPrint')}
            </button>
          )}
          <button type="button" onClick={refreshOrders} className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-xl text-sm font-medium min-h-[44px]">
            {t('refresh')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
        {PERIOD_IDS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl font-medium transition text-sm sm:text-base min-h-[44px] ${
              period === p ? 'btn-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t(p === 'day' ? 'daySettle' : p === 'week' ? 'weekSettle' : p === 'range' ? 'rangeSettle' : 'monthSettle')}
          </button>
        ))}
      </div>

      <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
        {period === 'day' && (
          <label className="flex items-center gap-2">
            <span className="text-stone-600">{t('selectDate')}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-stone-300 rounded-xl px-3 py-2 min-h-[44px]"
            />
          </label>
        )}
        {period === 'week' && (
          <label className="flex items-center gap-2">
            <span className="text-stone-600">{t('selectWeek')}</span>
            <select
              value={selectedWeekIndex}
              onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
              className="border border-stone-300 rounded-xl px-3 py-2 min-w-[200px] min-h-[44px]"
            >
              {weekOptions.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
        {period === 'month' && (
          <label className="flex items-center gap-2">
            <span className="text-stone-600">{t('selectMonth')}</span>
            <select
              value={selectedMonthIndex}
              onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
              className="border border-stone-300 rounded-xl px-3 py-2 min-w-[160px] min-h-[44px]"
            >
              {monthOptions.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
        {period === 'range' && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <label className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-stone-600 text-sm shrink-0">{t('rangeStart')}</span>
              <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 text-sm min-h-[44px] flex-1 min-w-0" />
            </label>
            <span className="text-stone-400">~</span>
            <label className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-stone-600 text-sm shrink-0">{t('rangeEnd')}</span>
              <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 text-sm min-h-[44px] flex-1 min-w-0" />
            </label>
          </div>
        )}
      </div>

      {/* 摘要卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-market rounded-2xl p-5">
          <div className="text-sm text-stone-500">{t('period')}</div>
          <div className="text-lg font-semibold text-stone-800 mt-1">{periodLabel}</div>
        </div>
        <div className="card-market rounded-2xl p-5">
          <div className="text-sm text-stone-500">{t('orderCount')}</div>
          <div className="text-2xl font-bold text-stone-800 mt-1">{report.count}</div>
        </div>
        <div className="card-market rounded-2xl p-5">
          <div className="text-sm text-stone-500">{t('revenue')}</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">NT$ {report.total.toLocaleString()}</div>
        </div>
      </div>

      {/* 付款方式統計 */}
      {report.orders.length > 0 && (
        <section>
          <h3 className="text-stone-700 font-medium mb-3">{t('reportPaymentBreakdown')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['line', 'cash', 'card'].map((key) => (
              <div key={key} className="card-market rounded-2xl p-4 flex flex-col">
                <div className="text-sm text-stone-500">{paymentLabel(t, key)}</div>
                <div className="text-lg font-semibold text-stone-800 mt-1">NT$ {paymentBreakdown[key].total.toLocaleString()}</div>
                <div className="text-xs text-stone-400 mt-0.5">{paymentBreakdown[key].count} {t('orderCount').toLowerCase()}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 產品分析 */}
      {productAnalysis.byProduct.length > 0 && (
        <section>
          <h3 className="text-stone-700 font-medium mb-3">{t('reportProductAnalysis')} · {t('reportTopProducts')}</h3>
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left min-w-[360px]">
              <thead>
                <tr className="bg-stone-100">
                  <th className="px-4 py-3 text-stone-600 font-medium text-sm">#</th>
                  <th className="px-4 py-3 text-stone-600 font-medium">{t('productName')}</th>
                  <th className="px-4 py-3 text-stone-600 font-medium">{t('category')}</th>
                  <th className="px-4 py-3 text-stone-600 font-medium text-right">{t('reportQuantitySold')}</th>
                  <th className="px-4 py-3 text-stone-600 font-medium text-right">{t('revenue')}</th>
                  <th className="px-4 py-3 text-stone-600 font-medium text-right">{t('reportRevenueShare')}</th>
                </tr>
              </thead>
              <tbody>
                {productAnalysis.byProduct.map((row, i) => (
                  <tr key={row.id ?? row.name} className="border-t border-stone-100">
                    <td className="px-4 py-2.5 text-stone-500 text-sm">{i + 1}</td>
                    <td className="px-4 py-2.5 text-stone-800 font-medium">{row.name}</td>
                    <td className="px-4 py-2.5 text-stone-600 text-sm">{row.category || '—'}</td>
                    <td className="px-4 py-2.5 text-stone-700 text-right">{row.qty}</td>
                    <td className="px-4 py-2.5 text-amber-800 font-medium text-right">NT$ {row.revenue.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-stone-600 text-right">
                      {report.total > 0 ? ((100 * row.revenue) / report.total).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 分類營收佔比圖表 */}
      {productAnalysis.byCategory.length > 0 && report.total > 0 && (
        <section>
          <h3 className="text-stone-700 font-medium mb-3">{t('reportCategoryChartTitle')}</h3>
          <p className="text-sm text-stone-500 mb-4">{t('reportCategoryChartHint')}</p>
          <div className="card-market rounded-2xl p-4 sm:p-6">
            <CategoryRevenueChart byCategory={productAnalysis.byCategory} totalRevenue={report.total} />
          </div>
        </section>
      )}

      {/* 分類營收（金額卡片） */}
      {productAnalysis.byCategory.length > 0 && (
        <section>
          <h3 className="text-stone-700 font-medium mb-3">{t('reportCategoryAnalysis')}</h3>
          <div className="flex flex-wrap gap-3">
            {productAnalysis.byCategory.map((row) => (
              <div key={row.category} className="card-market rounded-xl px-4 py-3 flex items-center justify-between gap-4 min-w-[140px]">
                <span className="text-stone-700 font-medium">{row.category}</span>
                <span className="text-amber-800 font-semibold">NT$ {row.revenue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 訂單明細（可編輯） */}
      <section>
        <h3 className="text-stone-700 font-medium mb-3">{t('orderDetail')}</h3>
        {report.orders.length === 0 ? (
          <p className="text-stone-500 py-8 text-center">{t('noOrdersInPeriod')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border border-stone-200 rounded-xl overflow-hidden min-w-[520px]">
              <thead>
                <tr className="bg-stone-100">
                  <th className="px-3 py-3 text-stone-600 font-medium text-sm">{t('time')}</th>
                  <th className="px-3 py-3 text-stone-600 font-medium text-sm">{t('orderId')}</th>
                  <th className="px-3 py-3 text-stone-600 font-medium text-sm">{t('amount')}</th>
                  <th className="px-3 py-3 text-stone-600 font-medium text-sm">{t('paymentMethod')}</th>
                  <th className="px-3 py-3 text-stone-600 font-medium text-sm w-32">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((order) => (
                  <tr key={order.id} className="border-t border-stone-100 hover:bg-stone-50/50">
                    <td className="px-3 py-2.5 text-stone-700 text-sm whitespace-nowrap">{formatReportDate(order.createdAt)}</td>
                    <td className="px-3 py-2.5 font-mono text-sm text-stone-600">#{order.id.slice(0, 8)}</td>
                    <td className="px-3 py-2.5 font-semibold text-amber-800">NT$ {order.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-stone-600 text-sm">{paymentLabel(t, order.paymentMethod || 'cash')}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => setReceiptOrder(order)}
                          className="px-2 py-1.5 text-xs sm:text-sm bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 min-h-[36px]"
                        >
                          {t('viewReceipt')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(order)}
                          className="px-2 py-1.5 text-xs sm:text-sm bg-amber-100 hover:bg-amber-200 rounded-lg text-amber-800 min-h-[36px]"
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(order)}
                          className="px-2 py-1.5 text-xs sm:text-sm bg-red-50 hover:bg-red-100 rounded-lg text-red-700 min-h-[36px]"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}

      {/* 編輯訂單彈窗 */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeEdit}>
          <div className="card-market rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-stone-800 mb-4">{t('edit')} #{editOrder.id.slice(0, 8)}</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-stone-600">{t('note')}</span>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="mt-1 w-full border border-stone-300 rounded-xl px-3 py-2 min-h-[44px]"
                  placeholder={t('orderNotePlaceholder')}
                />
              </label>
              <label className="block">
                <span className="text-sm text-stone-600">{t('amount')}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  className="mt-1 w-full border border-stone-300 rounded-xl px-3 py-2 min-h-[44px]"
                />
              </label>
              <label className="block">
                <span className="text-sm text-stone-600">{t('paymentMethod')}</span>
                <select
                  value={editPayment}
                  onChange={(e) => setEditPayment(e.target.value)}
                  className="mt-1 w-full border border-stone-300 rounded-xl px-3 py-2 min-h-[44px]"
                >
                  <option value="line">{t('payLine')}</option>
                  <option value="cash">{t('payCash')}</option>
                  <option value="card">{t('payCard')}</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={saveEdit} className="btn-primary text-white px-4 py-2.5 rounded-xl font-medium flex-1 min-h-[44px]">
                {t('save')}
              </button>
              <button type="button" onClick={closeEdit} className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 rounded-xl font-medium min-h-[44px]">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
