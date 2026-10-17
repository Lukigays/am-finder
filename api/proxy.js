/**
 * GET /api/proxy?u=<url cdn tiktok>
 *
 * Video & gambar TikTok CDN nggak bisa diputer/dimuat langsung dari browser
 * (butuh header Referer + sebagian kena blokir CORS). Endpoint ini jadi jembatan:
 * cuma nerusin byte-nya, host di luar daftar putih bakal ditolak.
 */

export const config = { runtime: 'edge' }

const ALLOW = /(?:^|\.)(?:tiktokcdn[a-z-]*\.com|tiktokv\.com|byteoversea\.com|ibyteimg\.com|muscdn\.com|tiktok\.com|tikwm\.com|akamaized\.net|ttwstatic\.com|firebasestorage\.googleapis\.com|googleusercontent\.com)$/i

export default async function handler(request) {
  const u = new URL(request.url).searchParams.get('u')
  if (!u) return new Response('parameter u kosong', { status: 400 })

  let target
  try { target = new URL(u) } catch { return new Response('url nggak valid', { status: 400 }) }
  if (!/^https?:$/.test(target.protocol) || !ALLOW.test(target.hostname)) {
    return new Response('host nggak diizinin', { status: 403 })
  }

  const range = request.headers.get('range')
  const head = request.method === 'HEAD'

  let up
  try {
    up = await fetch(target.href, {
      method: head ? 'HEAD' : 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        referer: 'https://www.tiktok.com/',
        origin: 'https://www.tiktok.com',
        accept: '*/*',
        ...(range ? { range } : {})
      },
      redirect: 'follow'
    })
  } catch {
    return new Response('gagal ambil dari sumber', { status: 502 })
  }

  if (!up.ok && up.status !== 206 && up.status !== 304) {
    return new Response('sumber nolak (' + up.status + ')', { status: up.status })
  }

  const h = new Headers()
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = up.headers.get(k)
    if (v) h.set(k, v)
  }
  if (!h.has('content-type')) h.set('content-type', 'video/mp4')
  if (!h.has('accept-ranges')) h.set('accept-ranges', 'bytes')
  h.set('access-control-allow-origin', '*')
  h.set('cross-origin-resource-policy', 'cross-origin')
  h.set('cache-control', 'public, max-age=3600, s-maxage=86400')

  return new Response(head ? null : up.body, { status: up.status, headers: h })
}
