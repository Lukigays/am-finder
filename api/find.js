/**
 * GET /api/find?url=<link TikTok>
 *
 * Orkestrator pencarian preset Alight Motion:
 *
 *   1. MESIN UTAMA  -> amfinder.web.id (basis data + verifikasi preset)
 *      Sumber: versi Node dari amfinder.js (author: Melvin — t.me/luyatiem,
 *      channel t.me/aboutvin7x). Endpoint-nya streaming SSE, jadi event
 *      "log" diabaikan dan cuma event "result" terakhir yang dipakai.
 *
 *   2. FALLBACK     -> lib/scanner.js (scanner mandiri: TikTok + komentar,
 *      link preset di-resolve sendiri). Dipakai kalau mesin utama error,
 *      timeout, atau nggak nemu apa-apa.
 *
 * Response akhir selalu pakai kontrak internal frontend:
 * { ok, videoId, video, author, scanned, presets }
 */

export const config = { maxDuration: 60 }

import { scanByTikwm, enrichPresets } from '../lib/scanner.js'

const AMFINDER = 'https://amfinder.web.id'
const UA_MAIN = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
const BUDGET = 46000 // ms, biar fungsi selalu jawab sebelum fungsi ke-timeout

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
})

/* ------------------------------ mesin utama ------------------------------ */

async function readSSE(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  if (!response.body) throw new Error('Response stream tidak tersedia')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const events = []
  let buffer = ''

  const parseBlock = block => {
    let event = 'message'
    const data = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (!data.length) return
    const raw = data.join('\n')
    let value
    try { value = JSON.parse(raw) } catch { value = raw }
    events.push({ event, data: value })
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

// ambil event "result" terakhir (bisa juga datang sebagai JSON biasa)
function finalResult(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const d = events[i].data
    if (d && typeof d === 'object' && 'ok' in d) return d
  }
  return null
}

async function amfinder(url) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 28000)
  try {
    const qs = new URLSearchParams({ url, bat: '80', chg: '1' })
    const r = await fetch(`${AMFINDER}/api/find?${qs}`, {
      headers: {
        accept: 'text/event-stream',
        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        referer: `${AMFINDER}/`,
        'user-agent': UA_MAIN
      },
      signal: ac.signal
    })
    return finalResult(await readSSE(r))
  } finally { clearTimeout(t) }
}

/* ------------------------------ normalisasi ------------------------------ */

const source = s => (['description', 'bio', 'bioLink', 'comment'].includes(s) ? s : 'comment')

// file Drive nggak dikasih thumbnail sama mesin utama -> bikin sendiri dari file id-nya
const driveId = u => (String(u).match(/\/file\/d\/([-\w]{10,})/) || String(u).match(/[?&]id=([-\w]{10,})/) || [])[1] || ''
const driveThumb = id => (id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : '')

function normalize(raw, url) {
  const v = raw.video || {}
  const a = raw.authorDetail || {}
  const links = Array.isArray(raw.presetLinks) ? raw.presetLinks : []

  const stats = v.stats || {}
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

  const scannedRaw = raw.scanned || {}
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
      comments: Number(scannedRaw.comments) || 0,
      replies: Number(scannedRaw.replies) || 0
    },
    presets,
    engine: 'amfinder'
  }
}

/* -------------------------------- handler -------------------------------- */

export default async function handler(request) {
  const t0 = Date.now()
  const url = (new URL(request.url).searchParams.get('url') || '').trim()
  if (!url) return json({ ok: false, error: 'Link TikTok-nya belum diisi.' }, 400)

  let mainErr = ''

  /* 1. mesin utama */
  try {
    const raw = await amfinder(url)
    if (raw && raw.ok) {
      const out = normalize(raw, url)
      if (out.presets.length) return json(out)
      mainErr = 'preset nggak ketemu di mesin utama'
    } else if (raw && raw.message) {
      mainErr = raw.message
    } else {
      mainErr = 'mesin utama nggak ngasih hasil'
    }
  } catch (e) {
    mainErr = e?.name === 'AbortError' ? 'mesin utama timeout' : (e?.message || 'mesin utama error')
  }

  /* 2. fallback: scanner mandiri */
  const left = Math.max(8000, BUDGET - (Date.now() - t0))
  try {
    const out = await scanByTikwm(url, { budgetMs: left })
    return json({ ...out, engine: 'scanner', fallbackFrom: mainErr })
  } catch (e) {
    return json({
      ok: false,
      error: `Preset nggak ketemu. Mesin utama: ${mainErr}. Scanner cadangan: ${String(e?.message || 'error').replace(/\.+$/, '')}.`
    }, 502)
  }
}

export { enrichPresets }
