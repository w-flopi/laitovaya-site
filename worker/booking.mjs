const times = ['12:00', '14:00', '16:00'];
const oneDay = 86_400_000;
const bookingEmail = 'zapis@example.com';
const pagesOrigin = 'https://w-flopi.github.io';

function schedule(now = Date.now()) {
  const moscow = new Date(now + 3 * 3_600_000);
  const firstDay = Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), moscow.getUTCDate());
  return Array.from({length:60}, (_, i) => {
    const date = new Date(firstDay + oneDay * i).toISOString().slice(0,10);
    return {date, slots:times.filter(time=>Date.parse(date+'T'+time+':00+03:00')>now)};
  }).filter(day=>day.slots.length);
}

export async function handleBooking(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const headers = {'Cache-Control':'no-store','Vary':'Origin'};
  if (origin === pagesOrigin) headers['Access-Control-Allow-Origin'] = pagesOrigin;
  const json = (data,status=200)=>Response.json(data,{status,headers});

  if (origin && origin !== url.origin && origin !== pagesOrigin) return json({error:'forbidden'},403);
  if (request.method === 'OPTIONS' && ['/api/slots','/api/book'].includes(url.pathname)) {
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '600';
    return new Response(null,{status:204,headers});
  }
  if (!env.DB) return json({error:'schedule_unavailable'},503);

  if (url.pathname === '/api/slots' && request.method === 'GET') {
    const days=schedule();
    const {results}=await env.DB.prepare(
      'SELECT day, time FROM workshop_bookings WHERE day >= ? AND day <= ?'
    ).bind(days[0].date,days.at(-1).date).all();
    const booked=new Set(results.map(row=>row.day+' '+row.time));
    return json({schedule:days.map(({date,slots})=>({
      date,slots:slots.map(time=>({time,busy:booked.has(date+' '+time)}))
    }))});
  }

  if (url.pathname === '/api/book' && request.method === 'POST') {
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'invalid_content_type'},415);
    const body=await request.json().catch(()=>null);
    if (!schedule().some(day=>day.date===body?.date && day.slots.includes(body.time))) return json({error:'invalid_slot'},422);
    const result=await env.DB.prepare(
      'INSERT INTO workshop_bookings (day, time) VALUES (?, ?) ON CONFLICT (day, time) DO NOTHING'
    ).bind(body.date,body.time).run();
    if (!result.meta.changes) return json({error:'slot_taken'},409);
    return json({recipient:bookingEmail},201);
  }

  return json({error:'not_found'},404);
}
