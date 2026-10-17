// Renderer hasil /api/find — format mengikuti API amfinder apa adanya:
// { ok, found, videoId, video:{ stats }, authorDetail, presetLinks[], otherLinks[], scanned }
// Tetap dibolehin baca field lama (presets / author / video.views) biar aman.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const num = n => n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' jt' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' rb' : n
export const ic = n => `<svg width="16" height="16"><use href="#i-${n}"/></svg>`

const SRC = { description: 'Dari deskripsi', bio: 'Dari bio', bioLink: 'Dari link bio', comment: 'Dari komentar', keyword: 'Dari pencarian' }

// ikon kontrol video (dipakai juga oleh js/script.js buat toggle play/mute)
export const PI = {
  p: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>',
  z: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  m: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  u: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 8a5 5 0 010 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
}

// ambil daftar preset dari format baru (presetLinks) atau format lama (presets)
export const presetList = j => {
  const raw = Array.isArray(j.presetLinks) ? j.presetLinks : Array.isArray(j.presets) ? j.presets : []
  return raw.filter(x => x && x.url).map(x => ({
    type: x.type === '5mb' ? '5mb' : 'xml',
    url: x.url,
    title: x.title || (x.type === '5mb' ? 'Preset Alight Motion' : 'File preset XML'),
    thumb: x.thumb || (Array.isArray(x.thumbs) ? x.thumbs[0] : '') || '',
    size: x.size || '',
    ratio: x.ratio || '',
    source: x.source || 'comment',
    verified: !!x.verified,
    byAuthor: typeof x.byAuthor === 'boolean' ? x.byAuthor : ['description', 'bio', 'bioLink'].includes(x.source)
  }))
}

export function renderResponse(j, { out, rv }) {
  const v = j.video || {}
  const st = v.stats || {}
  const a = j.authorDetail || j.author || {}
  const p = presetList(j)
  const links = p.map(x => x.url)

  const views = st.views ?? v.views
  const likes = st.likes ?? v.likes
  const comments = st.comments ?? v.comments
  const scan = j.scanned || {}
  const scannedComments = Number(scan.comments) || 0
  const scannedReplies = Number(scan.replies) || 0

  const play = v.src || (v.playUrlNoWm ? '/api/proxy?u=' + encodeURIComponent(v.playUrlNoWm) : '')
  const cover = v.cover || a.avatar || ''

  let h = `<div class="stitle"><b class="d">Video</b>${j.videoId ? `<span class="badge m">${esc(j.videoId)}</span>` : ''}</div>
  <div class="card"><div class="vid">
    <div class="frame" ${cover ? `style="background-image:url('${esc(cover)}')"` : ''}>${play ? `<video class="pv" src="${esc(play)}" data-px="${esc(play)}" data-from="amfinder" referrerpolicy="no-referrer" ${cover ? `poster="${esc(cover)}"` : ''} autoplay loop playsinline preload="metadata"></video>
      <div class="pctl"><button class="pbtn" data-a="pp" aria-label="Pause/Play">${PI.z}</button><button class="pbtn" data-a="mu" aria-label="Suara">${PI.u}</button></div>
      <i class="pbar"><b></b></i>` : `<a class="pnone" href="${esc(v.url || '#')}" target="_blank" rel="noopener">${ic('play')}<span>Buka di TikTok</span></a>`}</div>
    <div style="min-width:0">
      <p class="desc">${esc(v.description) || '<span class="nodesc">Nggak ada deskripsi</span>'}</p>
      <div class="stats">
        <div class="stat st-a"><small>Akun</small><b class="acc">${a.avatar ? `<img src="${esc(a.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<span style="overflow:hidden;text-overflow:ellipsis">@${esc(a.uniqueId || '')}</span></b></div>
        <div class="stat st-k"><small>Komentar</small><b>${num(comments)}</b></div>
        <div class="stat st-v"><small>Views</small><b>${num(views)}</b></div>
        <div class="stat st-l"><small>Likes</small><b>${num(likes)}</b></div>
      </div>
      <div class="chips"><span class="chip"><span class="dot"></span>${scannedComments} komentar${scannedReplies ? ` + ${scannedReplies} balasan` : ''} udah dicek</span><a class="chip" href="${esc(v.url || '#')}" target="_blank" rel="noopener">${ic('play')}Buka di TikTok</a></div>
    </div>
  </div></div>
  <div class="stitle" style="margin-top:32px"><b class="d">Link preset</b><span class="badge">${p.length}</span></div>`

  if (!p.length) {
    h += '<div class="card empty"><span class="ic"><svg width="26" height="26"><use href="#i-link"/></svg></span><h3>Presetnya nggak ketemu</h3><p>Udah dicek deskripsi, bio, komentar, sama balasannya, tapi nggak ada link preset di video ini.</p></div>'
  } else {
    h += '<div class="card plist">' + p.map((x, i) => {
      const am = x.type === '5mb'
      return `<div class="pre"><div class="th ${am ? 't5' : 'tx'}" ${x.thumb ? `style="background-image:url('${esc(x.thumb)}')"` : ''}>${x.thumb ? '' : (am ? '5MB' : 'XML')}</div><div class="pb">
        <h3 class="d">${esc(x.title)}</h3>
        <div class="chips" style="margin:8px 0 0"><span class="chip hi ${am ? 't5' : 'tx'}">${am ? '5MB' : 'XML'}</span>${x.size ? `<span class="chip">${esc(x.size)}</span>` : ''}${x.ratio ? `<span class="chip">Rasio ${esc(x.ratio)}</span>` : ''}${x.verified ? `<span class="chip">${ic('ok')}Terverifikasi</span>` : ''}${x.byAuthor ? '<span class="chip by">Dari pemilik video</span>' : ''}${x.pinned ? '<span class="chip pin">Dipin</span>' : ''}</div>
        <p class="who">${SRC[x.source] || ''}</p>
        <p class="m">${esc(x.url)}</p>
        <div class="act"><a class="btn p" href="${esc(x.url)}" target="_blank" rel="noopener">${am ? 'Buka preset' : 'Ambil file'}<svg class="arr" width="15" height="15"><use href="#i-out"/></svg></a><button class="btn o" data-c="${i}" data-s="idle"><span class="mi" style="width:16px;height:16px"><svg data-st="idle" viewBox="0 0 24 24"><use href="#i-copy"/></svg><svg data-st="ok" viewBox="0 0 24 24"><use href="#i-ok"/></svg></span><span class="lbs"><span data-st="idle">Salin</span><span data-st="ok">Udah disalin</span></span></button></div>
      </div></div>`
    }).join('') + '</div>'
  }

  // link lain (mis. grup WA dari komentar) — opsional
  const other = Array.isArray(j.otherLinks) ? j.otherLinks.filter(x => x && x.url) : []
  if (other.length) {
    h += `<div class="stitle" style="margin-top:32px"><b class="d">Link lain</b><span class="badge">${other.length}</span></div>
    <div class="card"><div class="chips" style="margin:0">${other.slice(0, 12).map(o => `<a class="chip" href="${esc(o.url)}" target="_blank" rel="noopener">${ic('link')}${esc(o.detail || o.source || 'Link')}</a>`).join('')}</div></div>`
  }

  const m = j.context?.matched
  if (Array.isArray(m) && m.length) {
    h += `<div class="chips" style="margin-top:16px">${m.slice(0, 8).map(t => `<span class="chip">#${esc(t)}</span>`).join('')}</div>`
  }

  out.innerHTML = h
  const pv = out.querySelector('video.pv'); if (pv) { pv.muted = false; pv.play().catch(() => {}) }
  const fr = out.querySelector('.frame'), stx = out.querySelector('.stitle'); let pr = stx
  rv(out.querySelector('.vid>div:last-child'), fr, 0); rv(stx, fr, 120)
  out.querySelectorAll('.pre,.card.empty').forEach((e, i) => { rv(e, pr, 220 + i * 90); pr = e })
  return links
}
