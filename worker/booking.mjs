const times = ['12:00', '15:00', '18:00'];
const oneDay = 86_400_000;
const email = 'zapis@example.com';
const json = (data, status = 200) => Response.json(data, {
  status, headers:{'Cache-Control':'no-store'}
});

function schedule(now = Date.now()) {
  const moscow = new Date(now + 3 * 3_600_000);
  const firstDay = Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), moscow.getUTCDate());
  return Array.from({length:21}, (_, i) => {
    const date = new Date(firstDay + oneDay * i).toISOString().slice(0,10);
    return {date, slots: times.filter(time => Date.parse(date + 'T' + time + ':00+03:00') > now)};
  }).filter(day => day.slots.length);
}

export async function handleBooking(request, env) {
  const url = new URL(request.url);
  if (!env.DB) return json({error:'schedule_unavailable'}, 503);

  if (url.pathname === '/api/slots' && request.method === 'GET') {
    const days = schedule();
    const {results} = await env.DB.prepare(
      'SELECT day, time FROM bookings WHERE day >= ? AND day <= ?'
    ).bind(days[0].date, days.at(-1).date).all();
    const booked = new Set(results.map(row => row.day + ' ' + row.time));
    return json({schedule:days.map(({date, slots}) => ({
      date, slots:slots.map(time => ({time, busy:booked.has(date + ' ' + time)}))
    }))});
  }

  if (url.pathname === '/api/book' && request.method === 'POST') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({error:'forbidden'}, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
      return json({error:'invalid_content_type'}, 415);
    }
    const body = await request.json().catch(() => null);
    if (!schedule().some(day => day.date === body?.date && day.slots.includes(body.time))) {
      return json({error:'invalid_slot'}, 422);
    }
    const result = await env.DB.prepare(
      'INSERT INTO bookings (day, time) VALUES (?, ?) ON CONFLICT (day, time) DO NOTHING'
    ).bind(body.date, body.time).run();
    if (!result.meta.changes) return json({error:'slot_taken'}, 409);
    return json({recipient:email}, 201);
  }

  return json({error:'not_found'}, 404);
}
