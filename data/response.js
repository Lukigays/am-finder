// Renderer hasil /api/find. Hanya PRESENTASI — kontrak response ({ok,videoId,video,author,scanned,presets}) tidak diubah.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const num = n => n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' jt' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' rb' : n
export const ic = n => `<svg width="16" height="16"><use href="#i-${n}"/></svg>`

const SRC = { description: 'Dari deskripsi', bio: 'Dari bio', bioLink: 'Dari link bio', comment: 'Dari komentar' }

// ikon kontrol video (dipakai juga oleh js/script.js buat toggle play/mute)
export const PI = {
  p: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>',
  z: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  m: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  u: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 8a5 5 0 010 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
}

// Render ke `out`, balikin daftar URL preset (index-nya dipakai tombol Salin: data-c).
export function renderResponse(j, { out, rv }) {
  const { video: v, author: a, presets: p } = j
  const links = p.map(x => x.url)
  let h = `<div class="stitle"><b class="d">Video</b></div>
  <div class="card"><div class="vid">
    <div class="frame" ${v.cover ? `style="background-image:url('${esc(v.cover)}')"` : ''}>${v.src ? `<video class="pv" src="${esc(v.src)}" data-alt="${esc(v.proxy || '')}" data-px="${esc(v.proxy || '')}" data-from="${esc(v.srcFrom || '')}" referrerpolicy="no-referrer" ${v.cover ? `poster="${esc(v.cover)}"` : ''} autoplay loop playsinline preload="metadata"></video>
      <div class="pctl"><button class="pbtn" data-a="pp" aria-label="Pause/Play">${PI.z}</button><button class="pbtn" data-a="mu" aria-label="Suara">${PI.u}</button></div>
      <i class="pbar"><b></b></i>` : `<a class="pnone" href="${esc(v.url)}" target="_blank" rel="noopener">${ic('play')}<span>Buka di TikTok</span></a>`}</div>
    <div style="min-width:0">
      <p class="desc">${esc(v.description) || '<span class="nodesc">Nggak ada deskripsi</span>'}</p>
      <div class="stats">
        <div class="stat st-a"><small>Akun</small><b class="acc">${a.avatar ? `<img src="${esc(a.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<span style="overflow:hidden;text-overflow:ellipsis">@${esc(a.uniqueId)}</span></b></div>
        <div class="stat st-k"><small>Komentar</small><b>${num(v.comments)}</b></div>
        <div class="stat st-v"><small>Views</small><b>${num(v.views)}</b></div>
        <div class="stat st-l"><small>Likes</small><b>${num(v.likes)}</b></div>
      </div>
      <div class="chips"><span class="chip"><span class="dot"></span>${j.scanned.comments} komentar${j.scanned.replies ? ` + ${j.scanned.replies} balasan` : ''} udah dicek</span><a class="chip" href="${esc(v.url)}" target="_blank" rel="noopener">${ic('play')}Buka di TikTok</a></div>
    </div>
  </div></div>
  <div class="stitle" style="margin-top:32px"><b class="d">Link preset</b><span class="badge">${p.length}</span></div>`
  if (!p.length) h += '<div class="card empty"><span class="ic"><svg width="26" height="26"><use href="#i-link"/></svg></span><h3>Presetnya nggak ketemu</h3><p>Udah dicek deskripsi, bio, komentar, sama balasannya, tapi nggak ada link preset di video ini.</p></div>'
  else h += '<div class="card plist">' + p.map((x, i) => {
    const am = x.type === '5mb', by = x.byAuthor || ['description', 'bio', 'bioLink'].includes(x.source)
    return `<div class="pre"><div class="th ${am ? 't5' : 'tx'}" ${x.thumb ? `style="background-image:url('${esc(x.thumb)}')"` : ''}>${x.thumb ? '' : (am ? '5MB' : 'XML')}</div><div class="pb">
      <h3 class="d">${esc(x.title || (am ? 'Preset Alight Motion' : 'File preset'))}</h3>
      <div class="chips" style="margin:8px 0 0"><span class="chip hi ${am ? 't5' : 'tx'}">${am ? '5MB' : 'XML'}</span>${x.size ? `<span class="chip">${esc(x.size)}</span>` : ''}${x.ratio ? `<span class="chip">Rasio ${esc(x.ratio)}</span>` : ''}${x.verified ? `<span class="chip">${ic('ok')}Terverifikasi</span>` : ''}${by ? '<span class="chip by">Dari pemilik video</span>' : ''}${x.pinned ? '<span class="chip pin">Dipin</span>' : ''}</div>
      <p class="who">${x.detail ? esc(x.detail) + ' · ' : ''}${SRC[x.source] || ''}</p>
      <p class="m">${esc(x.url)}</p>
      <div class="act"><a class="btn p" href="${esc(x.url)}" target="_blank" rel="noopener">${am ? 'Buka preset' : 'Ambil file'}<svg class="arr" width="15" height="15"><use href="#i-out"/></svg></a><button class="btn o" data-c="${i}" data-s="idle"><span class="mi" style="width:16px;height:16px"><svg data-st="idle" viewBox="0 0 24 24"><use href="#i-copy"/></svg><svg data-st="ok" viewBox="0 0 24 24"><use href="#i-ok"/></svg></span><span class="lbs"><span data-st="idle">Salin</span><span data-st="ok">Udah disalin</span></span></button></div>
    </div></div>`
  }).join('') + '</div>'
  out.innerHTML = h
  const pv = out.querySelector('video.pv'); if (pv) { pv.muted = false; pv.play().catch(() => {}) }
  const fr = out.querySelector('.frame'), st = out.querySelector('.stitle'); let pr = st
  rv(out.querySelector('.vid>div:last-child'), fr, 0); rv(st, fr, 120)
  out.querySelectorAll('.pre,.card.empty').forEach((e, i) => { rv(e, pr, 220 + i * 90); pr = e })
  return links
}
