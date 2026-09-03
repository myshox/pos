export async function onRequest({ request }) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const notice = await request.json();
    if (!notice?.rec_trade_id) return Response.json({ error: 'Invalid notification' }, { status: 400 });
    return Response.json({ status: 0, msg: 'OK' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
}
