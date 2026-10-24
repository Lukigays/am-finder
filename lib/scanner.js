/**
 * Scanner mandiri (fallback) — dipakai api/find.js kalau mesin utama (amfinder)
 * lagi nggak bisa diakses.
 *
 * Alur: metadata video TikTok -> deskripsi, bio, link bio, komentar, balasan
 * dicari link preset Alight Motion (5MB / XML), lalu judul + ukuran diambil
 * dari halaman share-nya.
 *
 * Return mengikuti kontrak frontend: { ok, videoId, video, author, scanned, presets }
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const TIKWM = 'https://www.tikwm.com/api'

const L = {
  perPage: 50,
  maxPages: 4,          // maksimal halaman komentar yang discan
  maxComments: 175,
  maxReplyThreads: 6,   // komentar yang balasannya diintip
  maxReplies: 120,
  enrich: 5             // maksimal link yang dibuka halaman detailnya (judul + ukuran)
}

/* ---------------------------------- util ---------------------------------- */

async function req(url, { headers = {}, redirect = 'follow', ms = 9000 } = {}) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'id-ID,id;q=0.9,en;q=0.8', ...headers },
      redirect,
      signal: ac.signal
    })
  } finally { clearTimeout(t) }
}

async function txt(url, opts) {
  try { const r = await req(url, opts); return r.ok ? await r.text() : '' } catch { return '' }
}

// API publiknya nge-limit "1 request/second", jadi semua panggilan tikwm
// dilewatkan satu antrean yang dijeda ~1,1 detik + retry kalau kena limit.
const GAP = 1100
let chain = Promise.resolve()
let last = 0
function slot() {
  const p = chain.then(async () => {
    const wait = Math.max(0, last + GAP - Date.now())
    if (wait) await new Promise(r => setTimeout(r, wait))
    last = Date.now()
  })
  chain = p.catch(() => {})
  return p
}

async function api(path, params, ms = 12000) {
  const qs = new URLSearchParams(params)
  for (let attempt = 0; attempt < 3; attempt++) {
    await slot()
    const t = await txt(`${TIKWM}/${path}?${qs}`, { ms, headers: { referer: 'https://www.tikwm.com/' } })
    if (t) {
      try {
        const j = JSON.parse(t)
        if (j && j.code === 0) return j.data
        if (!/limit/i.test(j?.msg || '')) return null // error permanen, nggak usah diulang
      } catch { /* respon bukan json, coba lagi */ }
    }
    await new Promise(r => setTimeout(r, 900))
  }
  return null
}

const dec = s => String(s ?? '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
const strip = (h, re) => { const m = String(h || '').match(re); return m ? dec(m[1]) : '' }
const hostOf = u => { try { return new URL(u).hostname.toLowerCase() } catch { return '' } }

/* ------------------------------- link scanner ------------------------------ */

// host preset "5MB" (share langsung dari aplikasi Alight Motion)
const IS_5MB = /(^|\.)(alight\.link|alightcreative\.com|alight\.motion|alightmotion\.com)$/i
// host yang umum dipakai buat nyebar XML
const IS_XML = /(^|\.)(drive\.google\.com|docs\.google\.com|mediafire\.com|mega\.nz|mega\.co\.nz|dropbox\.com|db\.tt|t\.me|telegram\.me|sfile\.mobi|sfile\.co|pixeldrain\.com|gofile\.io|github\.com|raw\.githubusercontent\.com|ddownload\.com|krakenfiles\.com|workupload\.com|megaup\.net|shrinkme\.io|shrinke\.me|shrinkearn\.com|linkvertise\.com|ouo\.io|yadi\.sk|mdisk\.pro)$/i

const BARE_HOSTS = 'alight\\.link|alightcreative\\.com|alight\\.motion|drive\\.google\\.com|docs\\.google\\.com|mediafire\\.com|mega\\.nz|dropbox\\.com|sfile\\.mobi|pixeldrain\\.com|gofile\\.io|t\\.me'

// rapihin teks: buang zero-width, normalkan obfuscation umum
const clean = t => String(t ?? '')
  .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
  .replace(/\[\s*\.\s*\]|\(\s*\.\s*\)|\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+/gi, '.')
  .replace(/hxxps?/gi, m => m.replace(/xx/i, 'tt'))

const tidy = u => u.replace(/[.,;:!?'")\]}>|`*]+$/g, '').replace(/^[<(]+/, '')

function collectUrls(text) {
  const t = clean(text)
  const set = new Set()
  let m
  const a = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi
  while ((m = a.exec(t))) set.add(m[0])
  const b = new RegExp(`(?<![\\w@./-])((?:${BARE_HOSTS})\\/[^\\s<>"'\`,]+)`, 'gi')
  while ((m = b.exec(t))) set.add('https://' + m[1])
  return [...set].map(tidy).filter(Boolean)
}

function classify(u) {
  const h = hostOf(u)
  if (!h) return null
  if (IS_5MB.test(h)) return '5mb'
  if (IS_XML.test(h)) return 'xml'
  try { if (/\.(xml|zip|rar|json)$/i.test(new URL(u).pathname)) return 'xml' } catch { /* ignore */ }
  if (/alightmotion|alight-motion|preset/i.test(u)) return 'xml'
  return null
}

function pick(text) {
  const found = []
  for (const u of collectUrls(text)) {
    const type = classify(u)
    if (type) found.push({ url: u, type })
  }
  return found
}

const driveId = u => (u.match(/\/file\/d\/([-\w]{10,})/) || u.match(/[?&]id=([-\w]{10,})/) || u.match(/\/d\/([-\w]{10,})/) || [])[1] || ''
const driveThumb = id => id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : null

const key = u => u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '')

const clip = (s, n = 92) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t
}

/* --------------------------- detail link 5MB (size) ------------------------ */

export async function enrichPresets(presets) {
  const five = presets.filter(p => p.type === '5mb' && /alightcreative\.com/i.test(p.url)).slice(0, L.enrich)
  const drv = presets.filter(p => p.type === 'xml' && /drive\.google\.com|docs\.google\.com/i.test(p.url)).slice(0, L.enrich)

  await Promise.allSettled([
    // halaman share Alight Creative: judul project + ukuran asli (mis. "1.7 MB")
    ...five.map(async p => {
      const h = await txt(p.url, { ms: 7000 })
      if (!h) return
      const size = h.match(/total\s+([\d.,]+\s*[KMG]B)/i)?.[1] || ''
      const og = strip(h, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || strip(h, /<title>([^<]+)<\/title>/i)
      if (size) p.size = size.replace(/\s+/g, ' ')
      if (og) p.title = clip(og.replace(/\s*[-–|]\s*Alight Motion.*$/i, ''), 92)
    }),
    // Google Drive: nama file XML-nya
    ...drv.map(async p => {
      const id = driveId(p.url)
      const h = await txt(`https://drive.google.com/file/d/${id}/view`, { ms: 7000 })
      const t = strip(h, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || strip(h, /<title>([^<]+)<\/title>/i)
      if (!t) return
      const name = t.replace(/\s*[-–]\s*Google Drive\s*$/i, '').trim()
      if (/\.(xml|zip|rar|json|txt)$/i.test(name)) p.title = clip(name, 92)
      if (!p.thumb) p.thumb = driveThumb(id)
    })
  ])
  return presets
}

/* ------------------------------- tikwm helpers ----------------------------- */

async function resolveShort(raw) {
  let u = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw
  for (let i = 0; i < 6; i++) {
    if (/\/(?:video|photo)\/\d{6,}/.test(u)) return u
    const h = hostOf(u)
    if (!/(^|\.)tiktok\.com$/i.test(h)) return u
    const r = await req(u, { redirect: 'manual', ms: 8000 })
    const loc = r.headers.get('location')
    if (!loc) return u
    u = new URL(dec(loc), u).href
  }
  return u
}

function videoIdOf(u) {
  const m = u.match(/\/(?:video|photo)\/(\d{6,25})/) || u.match(/\/(\d{15,25})(?:\D|$)/) || u.match(/(\d{15,25})/)
  return m ? m[1] : ''
}

async function comments(url, deadline) {
  const rows = []
  let cursor = 0, pages = 0, hasMore = true, total = 0
  while (hasMore && pages < L.maxPages && rows.length < L.maxComments && Date.now() < deadline) {
    const d = await api('comment/list', { url, count: L.perPage, cursor })
    pages++
    if (!d || !Array.isArray(d.comments) || !d.comments.length) break
    total = d.total || total
    for (const c of d.comments) {
      if (rows.length >= L.maxComments) break
      rows.push({ text: c.text || '', user: c.user?.unique_id || '', replies: c.reply_total || 0, id: c.id, likes: c.digg_count || 0 })
    }
    hasMore = !!d.hasMore
    cursor = d.cursor || cursor + L.perPage
    if (!d.hasMore) break
  }
  return { rows, total }
}

async function replies(videoId, thread) {
  const d = await api('comment/reply', { video_id: videoId, comment_id: thread.id, count: 35 }, 9000)
  if (!d || !Array.isArray(d.comments)) return []
  return d.comments.slice(0, 35).map(c => ({
    text: c.text || '', user: c.user?.unique_id || '', id: c.id, replyTo: thread.user
  }))
}

/* --------------------------------- handler -------------------------------- */

export async function scanByTikwm(src, { budgetMs = 46000 } = {}) {
  const deadline = Date.now() + budgetMs

  async function run() {
    /* 1. normalisasi link ------------------------------------------------ */
    const resolved = await resolveShort(src)
    const videoId = videoIdOf(resolved)
    if (!videoId || !/(^|\.)tiktok\.com$/i.test(hostOf(resolved))) {
      throw new Error('Link-nya nggak kebaca. Pastiin itu link video TikTok ya (contoh: https://vt.tiktok.com/xxxx).')
    }

    /* 2. metadata video -------------------------------------------------- */
    const canon = `https://www.tiktok.com/@i/video/${videoId}`
    const [meta, page] = await Promise.all([
      api('', { url: resolved, hd: 1 }, 14000),
      txt(`https://www.tiktok.com/@i/video/${videoId}`, { ms: 11000, headers: { referer: 'https://www.tiktok.com/' } })
        .then(h => h || txt(`https://m.tiktok.com/v/${videoId}.html`, { ms: 9000 }))
    ])

    const vURL = (meta && meta.author?.unique_id && `https://www.tiktok.com/@${meta.author.unique_id}/video/${videoId}`) || resolved || canon
    const paged = page || ''
    const uniq = (meta && meta.author?.unique_id) || strip(paged, /"uniqueId":"([^"]+)/)
    const finalURL = uniq ? `https://www.tiktok.com/@${uniq}/video/${videoId}` : vURL

    const description = dec((meta && meta.title) || strip(paged, /"desc":"((?:[^"\\]|\\.)*)"/) || '')
    const bio = dec(
      strip(paged, /"signature":"((?:[^"\\]|\\.)*)"/) ||
      (meta && meta.author?.signature) || ''
    ).replace(/\\n/g, '\n')
    const bioLink = dec(strip(paged, /"bioLink":\{"link":"((?:[^"\\]|\\.)*)"/) || strip(paged, /"link":"(https?:[^"]+)"/) || '')

    const video = {
      id: videoId,
      url: finalURL,
      embed: `https://www.tiktok.com/embed/v2/${videoId}`,
      src: null,
      proxy: null,
      srcFrom: null,
      description,
      comments: (meta && meta.comment_count) || Number(strip(paged, /"commentCount":(\d+)/)) || 0,
      views: (meta && meta.play_count) || Number(strip(paged, /"playCount":(\d+)/)) || 0,
      likes: (meta && meta.digg_count) || Number(strip(paged, /"diggCount":(\d+)/)) || 0,
      cover: (meta && (meta.cover || meta.origin_cover)) || strip(paged, /"cover":"((?:[^"\\]|\\.)*)"/) || null
    }

    const play = (meta && (meta.hdplay || meta.play)) || ''
    if (play) {
      // video TikTok CDN butuh referer, jadi diputer lewat proxy sendiri
      video.src = '/api/proxy?u=' + encodeURIComponent(play)
      video.proxy = video.src
      video.srcFrom = 'tiktok-cdn (via proxy)'
    }

    const author = {
      uniqueId: uniq || '',
      nickname: dec((meta && meta.author?.nickname) || strip(paged, /"nickname":"((?:[^"\\]|\\.)*)"/) || ''),
      avatar: (meta && meta.author?.avatar) || strip(paged, /"avatarLarger":"((?:[^"\\]|\\.)*)"/) || null,
      bio,
      bioLink
    }

    if (!meta && !paged) {
      throw new Error('Server TikTok lagi nggak bisa diakses dari sini. Coba lagi sebentar ya.')
    }

    /* 3. scan deskripsi, bio, dan link bio terlebih dahulu ----------------- */
    const presets = []
    const seen = new Map()
    const push = (link, meta2) => {
      const k = key(link.url)
      if (seen.has(k)) {
        const ex = seen.get(k)
        if (!ex.byAuthor && meta2.byAuthor) ex.byAuthor = true
        return
      }
      const p = { url: link.url, type: link.type, ...meta2 }
      if (p.type === 'xml') {
        const id = driveId(p.url)
        if (id) p.thumb = driveThumb(id)
      }
      seen.set(k, p)
      presets.push(p)
    }

    for (const l of pick(description)) push(l, { source: 'description', byAuthor: true, title: clip(description), detail: '' })
    for (const l of pick(bio)) push(l, { source: 'bio', byAuthor: true, title: clip(bio), detail: '' })
    for (const l of pick(bioLink)) push(l, { source: 'bioLink', byAuthor: true, title: clip(bioLink), detail: '' })

    /* 4. komentar + balasan, hanya kalau preset belum ditemukan ------------ */
    // Selain lebih cepat, ini menghindari rate limit TikWM saat fallback dipakai.
    let cl = []
    const rl = []
    if (!presets.length && Date.now() < deadline) {
      const scanned = await comments(finalURL, deadline)
      cl = scanned.rows
      if (!video.comments) video.comments = scanned.total

      const threads = cl.filter(c => c.replies > 0).sort((a, b) => b.replies - a.replies).slice(0, L.maxReplyThreads)
      const replySets = await Promise.allSettled(threads.map(async th => Date.now() > deadline - 7000 ? [] : replies(videoId, th)))
      replySets.forEach((s, i) => {
        if (s.status !== 'fulfilled') return
        for (const r of s.value) { if (rl.length < L.maxReplies) rl.push({ ...r, thread: threads[i].user }) }
      })

      for (const c of cl) {
        const own = !!uniq && c.user.toLowerCase() === uniq.toLowerCase()
        for (const l of pick(c.text)) push(l, { source: 'comment', byAuthor: own, title: clip(c.text), detail: c.user ? '@' + c.user : '' })
      }
      for (const r of rl) {
        const own = !!uniq && r.user.toLowerCase() === uniq.toLowerCase()
        for (const l of pick(r.text)) push(l, { source: 'comment', byAuthor: own, title: clip(r.text), detail: (r.user ? '@' + r.user : '') + ' (balasan)' })
      }
    }

    /* 5. ambil judul + ukuran asli dari halaman share Alight Motion -------- */
    await enrichPresets(presets)

    for (const p of presets) {
      if (!p.title) p.title = p.type === '5mb' ? 'Preset Alight Motion' : 'File preset XML'
      if (!p.size && p.type === '5mb') p.size = ''
    }

    return {
      ok: true,
      videoId,
      video,
      author,
      scanned: { comments: cl.length, replies: rl.length },
      presets
    }
  }

  return run()
}
