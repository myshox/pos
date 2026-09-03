export async function onRequest({ request }) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const notice = await request.json();
    if (notice?.status !== 0 || !notice?.rec_trade_id || !notice?.bank_transaction_id) {
      return Response.json({ error: 'Invalid notification' }, { status: 400 });
    }
    // TapPay only requires a successful 2xx acknowledgement. The transaction remains
    // queryable by rec_trade_id and can be reconciled from the TapPay portal.
    return Response.json({ status: 0, msg: 'OK' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
