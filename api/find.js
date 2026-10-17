/**
 * GET /api/find?url=<link TikTok>
 *
 * Satu-satunya sumber pencarian: API amfinder.
 *   Base URL : https://amfinder.web.id
 *   Author   : Melvin — t.me/luyatiem
 *   Channel  : https://t.me/aboutvin7x
 *   Channel WA: https://whatsapp.com/channel/0029VbDlfld4yltRwFKFL73X
 *
 * Endpoint-nya streaming SSE (event: log / event: result). Yang dipakai cuma
 * event "result" terakhir, lalu dinormalisasi ke bentuk yang dipakai frontend:
 * { ok, videoId, video, author, scanned, presets }
 *
 * File ini sengaja berdiri sendiri (tanpa import file lain) biar aman di-deploy
 * ke Vercel, dan SELALU balikin JSON (nggak pernah HTML), supaya frontend nggak
 * kena "Server ngasih respon aneh".
 */

const BASE = 'https://amfinder.web.id'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
const HEADERS = {
  Accept: 'text/event-stream',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: `${BASE}/`,
  'User-Agent': UA
}
const TIMEOUT = 45000

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
})

/* -------------------------------- SSE client ------------------------------- */

async function requestSSE(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT) })
  if (!response.ok) throw new Error(`amfinder balikin HTTP ${response.status}`)
  if (!response.body) throw new Error('response stream nggak tersedia')

  // jaga-jaga kalau suatu saat amfinder balikin JSON biasa, bukan SSE
  const type = response.headers.get('content-type') || ''
  if (/application\/json/i.test(type)) {
    const raw = await response.text()
    try { return [{ event: 'result', data: JSON.parse(raw) }] } catch { throw new Error('respon amfinder bukan JSON yang valid') }
  }

  const reader = response.body.getReader(), decoder = new TextDecoder(), events = []
  let buffer = ''

  const parseBlock = block => {
    let event = 'message'
    const lines = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) lines.push(line.slice(5).trim())
    }
    if (!lines.length) return
    const raw = lines.join('\n')
    let data
    try { data = JSON.parse(raw) } catch { data = raw }
    events.push({ event, data })
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() || ''
      for (const block of blocks) parseBlock(block)
    }
    buffer += decoder.decode()
    if (buffer.trim()) parseBlock(buffer)
  } finally {
    try { reader.releaseLock() } catch { /* ignore */ }
  }
  return events
}

function getFinalResult(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const data = events[i].data
    if (data && typeof data === 'object' && 'ok' in data) return data
  }
  return null
}

async function amfinder(targetUrl) {
  const events = await requestSSE(`${BASE}/api/find?url=${encodeURIComponent(targetUrl)}&bat=80&chg=1`)
  return getFinalResult(events)
}

/* ------------------------------ normalisasi -------------------------------- */

// file Drive nggak dikasih thumbnail sama amfinder -> bikin sendiri dari file id-nya
const driveId = u => (String(u).match(/\/file\/d\/([-\w]{10,})/) || String(u).match(/[?&]id=([-\w]{10,})/) || [])[1] || ''
const driveThumb = id => (id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : '')

const source = s => (['description', 'bio', 'bioLink', 'comment'].includes(s) ? s : 'comment')

function normalize(raw, url) {
  const v = raw.video || {}
  const a = raw.authorDetail || {}
  const stats = v.stats || {}
  const links = Array.isArray(raw.presetLinks) ? raw.presetLinks : []

  const video = {
    id: v.id || raw.videoId || '',
    url: v.url || raw.videoUrl || url,
    embed: `https://www.tiktok.com/embed/v2/${v.id || raw.videoId || ''}`,
    src: null,
    proxy: null,
    srcFrom: null,
    description: v.description || '',
    comments: stats.comments ?? 0,
    views: stats.views ?? 0,
    likes: stats.likes ?? 0,
    cover: v.cover || a.avatar || null
  }

  const play = v.playUrlNoWm || v.playUrl || ''
  if (play) {
    // video TikTok CDN butuh header Referer, jadi diputer lewat proxy sendiri
    video.src = '/api/proxy?u=' + encodeURIComponent(play)
    video.proxy = video.src
    video.srcFrom = 'amfinder → tiktok-cdn (via proxy)'
  }

  const presets = links
    .filter(p => p && p.url)
    .map(p => ({
      url: p.url,
      type: p.type === '5mb' ? '5mb' : 'xml',
      title: p.title || (p.type === '5mb' ? 'Preset Alight Motion' : 'File preset XML'),
      size: p.size || '',
      ratio: p.ratio || '',
      thumb: p.thumb || (Array.isArray(p.thumbs) ? p.thumbs[0] : '') || (p.type !== '5mb' ? driveThumb(driveId(p.url)) : ''),
      source: source(p.source),
      verified: !!p.verified,
      byAuthor: ['description', 'bio', 'bioLink'].includes(p.source),
      detail: ''
    }))

  const scanned = raw.scanned || {}
  return {
    ok: true,
    videoId: raw.videoId || video.id,
    video,
    author: {
      uniqueId: a.uniqueId || String(raw.author || '').replace(/^@/, ''),
      nickname: a.nickname || '',
      avatar: a.avatar || video.cover || null,
      bio: a.bio || '',
      bioLink: a.bioLink || ''
    },
    scanned: {
      comments: Number(scanned.comments) || 0,
      replies: Number(scanned.replies) || 0
    },
    presets,
    engine: 'amfinder'
  }
}

/* --------------------------------- handler -------------------------------- */

export default async function handler(request) {
  try {
    const url = (new URL(request.url).searchParams.get('url') || '').trim()

    if (!url) return json({ ok: false, error: 'Link TikTok-nya belum diisi.' })

    if (!/^https?:\/\//i.test(url)) {
      return json({ ok: false, error: 'Link-nya harus diawali https:// ya. Contoh: https://vt.tiktok.com/xxxx' })
    }

    let host = ''
    try { host = new URL(url).hostname.toLowerCase() } catch { /* urusan validasi di bawah */ }
    if (!/(^|\.)tiktok\.com$/i.test(host)) {
      return json({ ok: false, error: 'Itu bukan link TikTok yang lengkap. Contoh yang bener: https://vt.tiktok.com/xxxx atau https://www.tiktok.com/@user/video/123' })
    }

    const result = await amfinder(url)

    if (!result) return json({ ok: false, error: 'amfinder nggak ngasih hasil akhir. Coba lagi sebentar ya.' })
    if (!result.ok) return json({ ok: false, error: result.message || 'amfinder nolak link ini.' })

    return json(normalize(result, url))
  } catch (e) {
    const msg = e?.name === 'TimeoutError' || e?.name === 'AbortError'
      ? 'amfinder kelamaan jawab (timeout). Coba lagi ya.'
      : (e?.message || 'error nggak diketahui')
    return json({ ok: false, error: 'Gagal nyambung ke mesin pencari: ' + msg })
  }
}
