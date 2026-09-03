const ENDPOINTS = { sandbox: 'https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime', production: 'https://prod.tappaysdk.com/tpc/payment/pay-by-prime' };
const allowed = (origin) => origin === 'https://mogupos.org' || origin === 'https://pos-6q7.pages.dev' || /^https:\/\/[a-f0-9]+\.pos-6q7\.pages\.dev$/.test(origin);
const cors = (origin) => allowed(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
const json = (body, status, origin) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...cors(origin) } });

function normalizeDetails(details, amount) {
  try {
    const items = JSON.parse(details);
    if (!Array.isArray(items) || items.length === 0) throw new Error('invalid details');
    const normalized = items.map((item, index) => ({
      item_id: String(item?.item_id || `ITEM${index + 1}`).slice(0, 100),
      item_name: String(item?.item_name || 'Studio Mogu 商品').slice(0, 100),
      item_category: String(item?.item_category || 'IP文創商品').slice(0, 100),
      item_price: Number.isInteger(item?.item_price) && item.item_price >= 0 ? item.item_price : amount,
      item_quantity: Number.isInteger(item?.item_quantity) && item.item_quantity > 0 ? item.item_quantity : 1,
    }));
    const serialized = JSON.stringify(normalized);
    if (serialized.length <= 1000) return serialized;
  } catch { /* 使用安全的單品明細 */ }
  return JSON.stringify([{ item_id: 'ORDER', item_name: 'Studio Mogu POS 商品', item_category: 'IP文創商品', item_price: amount, item_quantity: 1 }]);
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  if (origin && !allowed(origin)) return json({ error: 'Origin not allowed' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  const partnerKey = env.TAPPAY_PARTNER_KEY;
  const merchantId = env.TAPPAY_AFTEE_MERCHANT_ID;
  if (!partnerKey || !merchantId) return json({ error: 'TapPay AFTEE 尚未完成商店設定' }, 503, origin);
  let input;
  try { input = await request.json(); } catch { return json({ error: '付款資料格式錯誤' }, 400, origin); }
  const { prime, amount, details, cardholder } = input || {};
  const validCustomer = cardholder && typeof cardholder.name === 'string' && cardholder.name.trim().length >= 2
    && typeof cardholder.phone_number === 'string' && /^[0-9+() -]{8,20}$/.test(cardholder.phone_number)
    && typeof cardholder.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardholder.email);
  if (typeof prime !== 'string' || prime.length < 20 || !Number.isInteger(amount) || amount < 1 || amount > 9_999_999 || !validCustomer) {
    return json({ error: 'AFTEE 付款資料不完整' }, 400, origin);
  }
  const id = `AF${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0, 6).replaceAll('-', '').toUpperCase()}`;
  const rawPhone = cardholder.phone_number.trim().replaceAll(' ', '').replaceAll('-', '');
  const phoneNumber = /^09\d{8}$/.test(rawPhone) ? `+886${rawPhone.slice(1)}` : rawPhone;
  const afteeDetails = normalizeDetails(details, amount);
  const serverType = env.TAPPAY_SERVER_TYPE === 'production' ? 'production' : 'sandbox';
  try {
    const response = await fetch(ENDPOINTS[serverType], {
      method: 'POST', signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': partnerKey },
      body: JSON.stringify({
        prime, partner_key: partnerKey, merchant_id: merchantId, amount, currency: 'TWD',
        order_number: id, bank_transaction_id: id, details: afteeDetails,
        cardholder: { phone_number: phoneNumber, name: cardholder.name.trim(), email: cardholder.email.trim() },
        result_url: {
          frontend_redirect_url: 'https://mogupos.org/aftee-return',
          backend_notify_url: 'https://pos-6q7.pages.dev/api/tappay/aftee-notify',
        },
      }),
    });
    const result = await response.json();
    return json(result, response.ok ? 200 : 502, origin);
  } catch (error) {
    return json({ error: error?.name === 'TimeoutError' ? 'TapPay 回應逾時' : 'TapPay 服務暫時無法連線' }, 502, origin);
  }
}
