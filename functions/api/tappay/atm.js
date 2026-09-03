const TAPPAY_ENDPOINTS = {
  sandbox: 'https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime',
  production: 'https://prod.tappaysdk.com/tpc/payment/pay-by-prime',
};

const isAllowedOrigin = (origin) => origin === 'https://mogupos.org'
  || /^https:\/\/[a-f0-9]+\.pos-6q7\.pages\.dev$/.test(origin)
  || origin === 'https://pos-6q7.pages.dev';

const corsHeaders = (origin) => isAllowedOrigin(origin) ? {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  Vary: 'Origin',
} : {};

const json = (body, status = 200, origin = '') => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', ...corsHeaders(origin) },
});

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  if (origin && !isAllowedOrigin(origin)) return json({ error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (Number(request.headers.get('content-length') || 0) > 12_000) return json({ error: '付款資料過大' }, 413, origin);

  const partnerKey = env.TAPPAY_PARTNER_KEY;
  const merchantId = env.TAPPAY_ATM_MERCHANT_ID;
  if (!partnerKey || !merchantId) return json({ error: 'TapPay ATM 尚未完成商店設定' }, 503, origin);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: '付款資料格式錯誤' }, 400, origin); }
  const { prime, amount, details, cardholder } = payload || {};
  const validCardholder = cardholder
    && typeof cardholder.name === 'string' && cardholder.name.trim().length >= 2
    && typeof cardholder.phone_number === 'string' && /^[0-9+() -]{8,20}$/.test(cardholder.phone_number)
    && typeof cardholder.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardholder.email);
  if (typeof prime !== 'string' || prime.length < 20 || !Number.isInteger(amount) || amount < 16 || amount > 49_999 || !validCardholder) {
    return json({ error: 'ATM 付款資料不完整，單筆金額須為 NT$16～49,999' }, 400, origin);
  }

  const serverType = env.TAPPAY_SERVER_TYPE === 'production' ? 'production' : 'sandbox';
  const orderNumber = `MOGU${Date.now().toString(36).toUpperCase()}`;
  try {
    const tappayResponse = await fetch(TAPPAY_ENDPOINTS[serverType], {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': partnerKey },
      body: JSON.stringify({
        prime,
        partner_key: partnerKey,
        merchant_id: merchantId,
        amount,
        currency: 'TWD',
        order_number: orderNumber,
        bank_transaction_id: orderNumber,
        details: typeof details === 'string' ? details.slice(0, 100) : 'Studio Mogu POS ATM order',
        cardholder: {
          phone_number: cardholder.phone_number.trim(),
          name: cardholder.name.trim(),
          email: cardholder.email.trim(),
        },
        result_url: { backend_notify_url: 'https://pos-6q7.pages.dev/api/tappay/atm-notify' },
        expire_in_days: 1,
      }),
    });
    const result = await tappayResponse.json();
    return json(result, tappayResponse.ok ? 200 : 502, origin);
  } catch (error) {
    return json({ error: error?.name === 'TimeoutError' ? 'TapPay 回應逾時' : 'TapPay 服務暫時無法連線' }, 502, origin);
  }
}
