const TAPPAY_ENDPOINTS = {
  sandbox: 'https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime',
  production: 'https://prod.tappaysdk.com/tpc/payment/pay-by-prime',
};

const env = globalThis.process?.env || {};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const partnerKey = env.TAPPAY_PARTNER_KEY;
  const merchantId = env.TAPPAY_MERCHANT_ID;
  if (!partnerKey || !merchantId) {
    return response.status(503).json({ error: 'TapPay 尚未完成商店設定' });
  }

  const { prime, amount, details, cardholder } = request.body || {};
  if (!prime || !Number.isInteger(amount) || amount <= 0 || amount > 1000000) {
    return response.status(400).json({ error: '付款資料不完整' });
  }

  const serverType = env.TAPPAY_SERVER_TYPE === 'production' ? 'production' : 'sandbox';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const tappayResponse = await fetch(TAPPAY_ENDPOINTS[serverType], {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': partnerKey },
      body: JSON.stringify({ prime, partner_key: partnerKey, merchant_id: merchantId, amount, currency: 'TWD', details: details || 'Studio Mogu POS order', cardholder }),
    });
    const result = await tappayResponse.json();
    return response.status(tappayResponse.ok ? 200 : 502).json(result);
  } catch (error) {
    return response.status(502).json({ error: error?.name === 'AbortError' ? 'TapPay 回應逾時' : 'TapPay 服務暫時無法連線' });
  } finally {
    clearTimeout(timeoutId);
  }
}
