function decodeMedia(encoded) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(encoded);
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let i=0; i<raw.length; i++) bytes[i]=raw.charCodeAt(i);
  return bytes;
}

export default {
  async fetch(request, env) {
    const {pathname} = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      try {
        return await handleBooking(request, env);
      } catch (error) {
        console.error(error);
        return Response.json({error:'schedule_unavailable'}, {
          status:503, headers:{'Cache-Control':'no-store'}
        });
      }
    }
    if (!['GET','HEAD'].includes(request.method)) return new Response(null, {status:405});
    const path = pathname === '/' ? '/index.html' : pathname;
    if (!Object.hasOwn(assets,path)) return new Response('Страница не найдена', {status:404});
    const video = path.endsWith('.mp4');
    const binary = /\.(mp4|gif|jpg|webp)$/.test(path);
    const bytes = binary ? decodeMedia(assets[path])
      : new TextEncoder().encode(assets[path]);
    const headers = new Headers({'Content-Type':video ? 'video/mp4' :
      path.endsWith('.html') ? 'text/html; charset=utf-8' :
      path.endsWith('.css') ? 'text/css; charset=utf-8' :
      path.endsWith('.gif') ? 'image/gif' : path.endsWith('.jpg') ? 'image/jpeg' : path.endsWith('.webp') ? 'image/webp' : 'text/javascript; charset=utf-8'});
    headers.set('Cache-Control',binary ? 'private, max-age=3600' : 'no-cache');
    let start = 0, end = bytes.length - 1, status = 200;
    if (video) {
      headers.set('Accept-Ranges','bytes');
      const range = request.headers.get('Range');
      const parts = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
      if (parts) {
        if (parts[1]) {
          start = Number(parts[1]);
          if (parts[2]) end = Math.min(Number(parts[2]), end);
        } else if (parts[2]) {
          start = Math.max(0, bytes.length - Number(parts[2]));
        }
        if (start >= bytes.length || start > end) {
          headers.set('Content-Range','bytes */' + bytes.length);
          return new Response(null,{status:416,headers});
        }
        headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + bytes.length);
        status = 206;
      }
    }
    headers.set('Content-Length', String(end - start + 1));
    return new Response(request.method === 'HEAD' ? null : bytes.subarray(start,end+1), {status,headers});
  }
};
