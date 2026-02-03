/** 當日 00:00:00 (本地) */
export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 當日 23:59:59.999 */
export function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** 該週週日 00:00:00（週為 日～六） */
export function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 該週週六 23:59:59.999 */
export function endOfWeek(d) {
  const s = startOfWeek(d);
  const x = new Date(s);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** 該月 1 日 00:00:00 */
export function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 該月最後一天 23:59:59.999 */
export function endOfMonth(d) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** 訂單是否在 [start, end] 區間內（含 start、end） */
export function orderInRange(order, start, end) {
  const t = new Date(order.createdAt).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** 依日期區間篩選訂單，回傳 { orders, count, total } */
export function getOrdersInRange(orders, start, end) {
  const list = orders.filter((o) => orderInRange(o, start, end));
  const total = list.reduce((sum, o) => sum + o.total, 0);
  return { orders: list, count: list.length, total };
}

/** 日結：選一天 */
export function getDailyReport(orders, date) {
  const start = startOfDay(date);
  const end = endOfDay(date);
  return getOrdersInRange(orders, start, end);
}

/** 周結：選一週（以該週任一天代表整週） */
export function getWeeklyReport(orders, dateInWeek) {
  const start = startOfWeek(dateInWeek);
  const end = endOfWeek(dateInWeek);
  return getOrdersInRange(orders, start, end);
}

/** 月結：選一月 */
export function getMonthlyReport(orders, year, month) {
  const d = new Date(year, month - 1, 1);
  const start = startOfMonth(d);
  const end = endOfMonth(d);
  return getOrdersInRange(orders, start, end);
}

/** 取得可選的週列表（最近 N 週，每週用週日日期表示） */
export function getWeekOptions(count = 12) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() - i * 7);
    options.push({ date: d, label: formatWeekLabel(d) });
  }
  return options;
}

/** 取得可選的月份列表（最近 N 月） */
export function getMonthOptions(count = 12) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`,
    });
  }
  return options;
}

function formatWeekLabel(sundayDate) {
  const end = new Date(sundayDate);
  end.setDate(end.getDate() + 6);
  return `${sundayDate.getMonth() + 1}/${sundayDate.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
}

export function formatReportDate(iso) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 付款方式統計：{ line: { count, total }, cash: { count, total }, card: { count, total } } */
export function getPaymentBreakdown(orders) {
  const breakdown = { line: { count: 0, total: 0 }, cash: { count: 0, total: 0 }, card: { count: 0, total: 0 } };
  for (const o of orders) {
    const key = o.paymentMethod === 'line' || o.paymentMethod === 'card' ? o.paymentMethod : 'cash';
    breakdown[key].count += 1;
    breakdown[key].total += o.total;
  }
  return breakdown;
}

/** 產品分析：依訂單明細彙總，回傳 { byProduct: [], byCategory: [] } */
export function getProductAnalysis(orders) {
  const productMap = new Map(); // key: product id or name
  const categoryMap = new Map();
  for (const order of orders) {
    if (!order.items || !Array.isArray(order.items)) continue;
    for (const item of order.items) {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const revenue = qty * price;
      const key = item.id != null ? String(item.id) : (item.name || '');
      const cat = item.category || '';
      if (key) {
        const cur = productMap.get(key) || { id: item.id, name: item.name || key, category: cat, qty: 0, revenue: 0 };
        cur.qty += qty;
        cur.revenue += revenue;
        productMap.set(key, cur);
      }
      if (cat) {
        const cur = categoryMap.get(cat) || { category: cat, qty: 0, revenue: 0, orderCount: 0 };
        cur.qty += qty;
        cur.revenue += revenue;
        categoryMap.set(cat, cur);
      }
    }
  }
  const byProduct = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue);
  const byCategory = Array.from(categoryMap.values())
    .sort((a, b) => b.revenue - a.revenue);
  return { byProduct, byCategory };
}
