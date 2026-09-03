const ENDPOINTS = { sandbox: 'https://sandbox.tappaysdk.com/tpc/transaction/query', production: 'https://prod.tappaysdk.com/tpc/transaction/query' };
const allowed = (origin) => origin === 'https://mogupos.org' || origin === 'https://pos-6q7.pages.dev' || /^https:\/\/[a-f0-9]+\.pos-6q7\.pages\.dev$/.test(origin);
const cors = (origin) => allowed(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
const json = (body, status, origin) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...cors(origin) } });

export async function onRequest({ request, env }) {
  const origin = request.headers.get('origin') || '';
  if (origin && !allowed(origin)) return json({ error: 'Origin not allowed' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  let input;
  try { input = await request.json(); } catch { return json({ error: '資料格式錯誤' }, 400, origin); }
  if (typeof input?.recTradeId !== 'string' || !/^[A-Za-z0-9]{8,30}$/.test(input.recTradeId)) return json({ error: '交易編號格式錯誤' }, 400, origin);
  const partnerKey = env.TAPPAY_PARTNER_KEY;
  if (!partnerKey) return json({ error: 'TapPay 尚未完成設定' }, 503, origin);
  const serverType = env.TAPPAY_SERVER_TYPE === 'production' ? 'production' : 'sandbox';
  try {
    const response = await fetch(ENDPOINTS[serverType], {
      method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json', 'x-api-key': partnerKey },
      body: JSON.stringify({ partner_key: partnerKey, filters: { rec_trade_id: input.recTradeId } }),
    });
    return json(await response.json(), response.ok ? 200 : 502, origin);
  } catch (error) {
    return json({ error: error?.name === 'TimeoutError' ? 'TapPay 查詢逾時' : 'TapPay 查詢暫時無法連線' }, 502, origin);
  }
}
