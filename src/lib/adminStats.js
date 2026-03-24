import {
  getDailyReport,
  activeOrdersOnly,
  isOrderVoided,
  getPaymentBreakdown,
  getProductAnalysis,
} from './reportUtils';

/** 後台儀表板：今日／昨日／本週摘要、付款占比、熱銷、低庫存 */
export function getAdminDashboardStats(orders, products) {
  const all = Array.isArray(orders) ? orders : [];
  const active = activeOrdersOnly(all);
  const now = new Date();

  const todayRep = getDailyReport(all, now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterdayRep = getDailyReport(all, y);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  let weekOrders = active.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });
  const weekTotal = weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const weekCount = weekOrders.length;

  const avgTicketToday =
    todayRep.count > 0 ? Math.round(todayRep.total / todayRep.count) : 0;

  const paymentToday = getPaymentBreakdown(todayRep.orders);
  const productToday = getProductAnalysis(todayRep.orders);
  const topProducts = productToday.byProduct.slice(0, 5);

  const lowStock = (Array.isArray(products) ? products : [])
    .filter((p) => p.useStock && typeof p.stock === 'number' && p.stock <= 5 && p.stock > 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8);

  const outOfStock = (Array.isArray(products) ? products : [])
    .filter((p) => p.useStock && typeof p.stock === 'number' && p.stock === 0 && p.isActive)
    .slice(0, 8);

  const recent = [...active]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const voidCount = all.filter(isOrderVoided).length;

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const r = getDailyReport(all, d);
    last7Days.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      total: r.total,
      count: r.count,
    });
  }

  return {
    today: { total: todayRep.total, count: todayRep.count, avgTicket: avgTicketToday },
    yesterday: { total: yesterdayRep.total, count: yesterdayRep.count },
    week: { total: weekTotal, count: weekCount },
    paymentToday,
    topProducts,
    lowStock,
    outOfStock,
    recentOrders: recent,
    voidCount,
    last7Days,
    totalOrdersAllTime: active.length,
  };
}
