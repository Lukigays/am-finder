import { menuItems, SOCIALS } from '../data/socials.js'
import { renderInfo } from '../data/info.js'
import { renderDeveloper } from '../data/developer.js'
import { renderResponse, PI, esc } from '../data/response.js'

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]
const rm = matchMedia('(prefers-reduced-motion:reduce)').matches
const u = $('#u'), out = $('#out')
const EASE = 'cubic-bezier(.16,1,.3,1)'
let links = [], view = 'main', busy = false, swBusy = false

/* ---------- util: toast, copy, scroll ---------- */
function toast(m, err) { const e = document.createElement('div'); e.className = 't' + (err ? ' e' : ''); e.innerHTML = '<i></i><span></span>'; e.lastChild.textContent = m; $('#ts').append(e); setTimeout(() => e.remove(), 2200) }
async function copy(s) { try { await navigator.clipboard.writeText(s) } catch { const a = document.createElement('textarea'); a.value = s; document.body.append(a); a.select(); document.execCommand('copy'); a.remove() } toast('Link udah disalin!') }
const go = h => { setMenu(false); document.querySelector(h)?.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' }) }
const flash = (b, st, ms = 1700) => { clearTimeout(b._t); b.dataset.s = st; b._t = setTimeout(() => b.dataset.s = 'idle', ms) }

/* ---------- render data modular ---------- */
renderInfo($('#info-grid'))
renderDeveloper($('#v-dev'))
$('#menu').innerHTML = '<small>Ikutin developernya</small>' + menuItems.map(m => {
  const body = `<span class="sq"><svg width="20" height="20"><use href="#i-${m.icon}"/></svg></span><span><b>${esc(m.label)}</b><span>${esc(m.sub)}</span></span><svg width="16" height="16"><use href="#i-${m.view ? 'arr' : 'out'}"/></svg>`
  if (m.view) return `<a href="#developer" data-view="${m.view}">${body}</a>`
  return m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${body}</a>` : `<a href="#" data-na aria-disabled="true">${body}</a>`
}).join('')
if (SOCIALS.whatsappChannel.url) { const w = $('#ibw'); w.href = SOCIALS.whatsappChannel.url; w.hidden = false }
document.addEventListener('click', e => { const a = e.target.closest('[data-na]'); if (a) { e.preventDefault(); toast('Link ini belum diisi sama owner', 1) } })

/* ---------- menu hamburger ---------- */
const setMenu = o => { $('#mw').classList.toggle('open', o); $('#mb').classList.toggle('open', o); $('#mb').setAttribute('aria-expanded', o) }
$('#mb').onclick = e => { e.stopPropagation(); setMenu(!$('#mw').classList.contains('open')) }
document.addEventListener('click', e => { if (!e.target.closest('#mw')) setMenu(false) })
document.addEventListener('keydown', e => e.key === 'Escape' && setMenu(false))

/* ---------- navigasi: view (main/dev) + bottom nav + observer ---------- */
const setNav = k => { const L = $$('.bn a'); L.forEach(a => a.classList.toggle('on', a.dataset.k === k)); $('.ind').style.transform = `translateX(${L.findIndex(a => a.dataset.k === k) * 100}%)` }
function showView(v, after) {
  setMenu(false)
  if (v === view) { after && after(); return }
  if (swBusy) return
  const from = $('#v-' + view), to = $('#v-' + v); view = v
  const swap = () => {
    from.hidden = true; to.hidden = false
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (!rm) to.animate([{ opacity: 0, transform: 'translateY(18px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE })
    swBusy = false; after && after()
  }
  swBusy = true
  if (rm) return swap()
  const a = from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(.985)' }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
  a.onfinish = () => { a.cancel(); swap() }
}
const toMain = sel => { setNav(sel.slice(1)); showView('main', () => go(sel)) }
$$('.bn a').forEach(a => a.onclick = e => {
  e.preventDefault(); const k = a.dataset.k
  if (k === 'dev') { setNav('dev'); showView('dev') } else toMain('#' + k)
})
$$('[data-go]').forEach(b => b.onclick = () => { const t = b.dataset.go; if (view !== 'main') { setNav('cari'); showView('main', () => go(t)) } else { setNav('cari'); go(t) } })
document.addEventListener('click', e => { const a = e.target.closest('[data-view]'); if (!a) return; e.preventDefault(); setNav('dev'); showView(a.dataset.view) })
;['cari', 'hasil', 'info'].forEach(id => { new IntersectionObserver(es => es.forEach(e => e.isIntersecting && view === 'main' && setNav(id)), { rootMargin: '-40% 0px -50% 0px' }).observe(document.getElementById(id)) })

/* ---------- input: clear, paste, enter ---------- */
u.oninput = () => { const c = $('#cl'); c.classList.toggle('hid', !u.value); c.dataset.s = u.value ? 'idle' : 'hid' }
$('#cl').onclick = () => { u.value = ''; u.oninput(); u.focus() }
$('#pc').onclick = async () => { const b = $('#pc'); try { u.value = (await navigator.clipboard.readText()).trim(); u.oninput(); flash(b, 'ok', 1200); if (u.value) search() } catch { flash(b, 'err', 1400); u.focus(); toast('Clipboard nggak diizinkan, tempel manual aja ya', 1) } }
$('#go').onclick = search; u.onkeydown = e => e.key === 'Enter' && search()
out.onclick = e => { const b = e.target.closest('[data-c]'); if (b) { copy(links[b.dataset.c]); flash(b, 'ok', 1800) } }

/* ---------- loader pencarian global ---------- */
const sl = $('#sl')
function openLoader() {
  sl.hidden = false; sl.setAttribute('aria-hidden', 'false'); sl.dataset.s = 'busy'
  void sl.offsetWidth; sl.classList.add('on')
}
function endLoader(st, label, done) {
  if (label) $('#slerr').textContent = label
  sl.dataset.s = st
  setTimeout(() => {
    sl.classList.remove('on')
    setTimeout(() => { sl.hidden = true; sl.setAttribute('aria-hidden', 'true'); busy = false; done && done() }, rm ? 20 : 450)
  }, rm ? 500 : 1300)
}

/* ---------- search (API: /api/find?url=...) ---------- */
async function search() {
  if (busy) return
  const v = u.value.trim()
  if (!v) { const f = $('.field'); f.classList.remove('sh'); void f.offsetWidth; f.classList.add('sh'); return u.focus() }
  busy = true; u.blur(); openLoader()
  out.innerHTML = '<div class="card empty"><span class="ic"><span class="dot live"></span></span><h3>Lagi ngecek videonya…</h3><p>Deskripsi, bio, komentar, sama balasan lagi dicek satu-satu. Bisa sampai setengah menit, sabar ya.</p></div>'
  try {
    let r, t
    try { r = await fetch('/api/find?url=' + encodeURIComponent(v)); t = await r.text() }
    catch { throw new Error('Nggak bisa nyambung ke server. Cek koneksi, lalu coba lagi ya.') }
    let j
    try { j = JSON.parse(t) } catch {
      if (r.status === 404 || /not found/i.test(t)) throw new Error('Function /api/find nggak ketemu. Pastiin folder api/ ikut ke-deploy ya.')
      if (r.status === 504) throw new Error('Server kelamaan nyari preset (timeout). Coba lagi ya.')
      throw new Error('Respon server nggak valid (HTTP ' + r.status + '). Coba lagi sebentar ya.')
    }
    if (!j.ok) throw new Error(j.error || 'Ada yang error, coba lagi ya')
    links = renderResponse(j, { out, rv }); history.replaceState(null, '', '?url=' + encodeURIComponent(v))
    if (links.length) endLoader('ok', null, () => { setNav('hasil'); go('#hasil') })
    else { toast('Yah, presetnya nggak ketemu', 1); endLoader('err', 'Preset nggak ketemu') }
  } catch (e) {
    out.innerHTML = '<div class="card empty"><span class="ic err"><svg width="26" height="26"><use href="#i-info"/></svg></span><h3>Yah, gagal</h3><p class="err">' + esc(e.message) + '</p></div>'
    toast(e.message, 1); endLoader('err', 'Gagal nyari preset')
  }
}

/* ---------- kontrol video + fallback sumber ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('.frame [data-a]'); const f = e.target.closest('.frame'); if (!f) return
  const v = f.querySelector('video'); if (!v) return
  if (b && b.dataset.a === 'mu') { v.muted = !v.muted; return }
  if (b && b.dataset.a === 'pp' || !b) { v.paused ? v.play() : v.pause() }
})
document.addEventListener('volumechange', e => { const v = e.target; if (v.tagName !== 'VIDEO') return; const b = v.closest('.frame')?.querySelector('[data-a=mu]'); if (b) b.innerHTML = v.muted || v.volume === 0 ? PI.m : PI.u }, true)
document.addEventListener('play', e => { const b = e.target.closest?.('.frame')?.querySelector('[data-a=pp]'); if (b) b.innerHTML = PI.z }, true)
document.addEventListener('pause', e => { const b = e.target.closest?.('.frame')?.querySelector('[data-a=pp]'); if (b) b.innerHTML = PI.p }, true)
document.addEventListener('loadedmetadata', e => { const v = e.target; if (v.tagName !== 'VIDEO' || !v.videoWidth || !v.videoHeight) return; const f = v.closest('.frame'); if (f) f.style.setProperty('--ar', v.videoWidth + '/' + v.videoHeight) }, true)
document.addEventListener('timeupdate', e => { const v = e.target; if (v.tagName !== 'VIDEO') return; const g = v.closest('.frame')?.querySelector('.pbar b'); if (g && v.duration) g.style.width = (v.currentTime / v.duration * 100) + '%' }, true)
document.addEventListener('error', e => {
  const v = e.target; if (v.tagName !== 'VIDEO') return
  if (v.dataset.alt) { const a = v.dataset.alt; v.dataset.alt = ''; v.src = a; v.load(); v.play().catch(() => {}); return }
  const f = v.closest('.frame'); if (!f) return
  const src = v.dataset.px || v.currentSrc, from = v.dataset.from || '?', tu = document.querySelector('a.chip[href*="tiktok.com"]')?.href || 'https://www.tiktok.com'
  f.innerHTML = '<a class="pnone" href="' + esc(tu) + '" target="_blank" rel="noopener"><span>Video nggak bisa diputar di sini</span><span style="opacity:.7">Buka di TikTok</span><small id="vdbg" style="opacity:.6;font:500 11px Archivo"></small></a>'
  fetch(src, { headers: { Range: 'bytes=0-0' } }).then(async r => { const d = document.getElementById('vdbg'); if (d) d.textContent = from + ' · ' + (r.ok ? 'proxy ok (' + r.status + ') tapi gagal diputar' : r.status + ' ' + (await r.text()).slice(0, 50)) }).catch(() => { const d = document.getElementById('vdbg'); if (d) d.textContent = from })
}, true)

/* ---------- animasi: fly-in, scroll reveal, intro morph ---------- */
const fly = (e, n, d = 0) => { if (!e || !n || rm) return; const a = e.getBoundingClientRect(), b = n.getBoundingClientRect(), c = v => Math.max(-120, Math.min(120, v)); e.animate([{ opacity: 0, transform: `translate(${c(b.left + b.width / 2 - a.left - a.width / 2)}px,${c(b.top + b.height / 2 - a.top - a.height / 2)}px) scale(.94)` }, { opacity: 1, transform: 'none' }], { duration: 700, delay: d, easing: EASE, fill: 'backwards' }) }
const h = document.documentElement, ig = $('#ig'), bx = $('.igb'), inn = $('.igi')
clearTimeout(window._f)
const W = () => Math.min(innerWidth * .88, 340) + 'px', fit = () => { bx.style.height = inn.scrollHeight + 'px' }
const openIntro = () => { bx.style.width = W(); bx.style.borderRadius = '10px'; fit(); bx.classList.add('o') }
setTimeout(openIntro, rm ? 0 : 900)
document.fonts?.ready.then(() => bx.classList.contains('o') && fit())
addEventListener('resize', () => { if (bx.classList.contains('o')) { bx.style.width = W(); fit() } })
const asm = o => {
  const vh = innerHeight, fl = (e, dl) => { const r = e.getBoundingClientRect()
    if (r.top > vh || !r.width) return e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: dl, fill: 'backwards' })
    const dx = o.x - (r.left + r.width / 2), dy = o.y - (r.top + r.height / 2)
    e.animate([{ opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.3)` }, { opacity: 1, offset: .35 }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: dl, easing: EASE, fill: 'backwards' }) }
  let i = 0
  ;['header', '.hero>*', '#cari .card', '#out .card', '.fi', '.foot', '.bn'].forEach(q => $$(q).forEach(e => { e._d = i++ * 65; fl(e, e._d) }))
  $$('.card,.fi').forEach(c => c.querySelectorAll('.ic,h2,h3,p,.field,.go').forEach(t => t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 550, delay: (c._d || 0) + 260, easing: 'ease-out', fill: 'backwards' })))
}
// rangkai pas scroll (atas & bawah)
const list = []; let io, dY = 1, ly = scrollY, ready = false; addEventListener('scroll', () => { dY = scrollY >= ly ? 1 : -1; ly = scrollY }, { passive: true })
const inV = e => { const r = e.getBoundingClientRect(); return r.top < innerHeight - 40 && r.bottom > 40 }
const play = e => { e._t = performance.now()
  if (e._n && !e._p) { e._p = 1; return fly(e, e._n, e._d) }
  e.animate([{ opacity: 0, transform: `translateY(${dY * 40}px) scale(.92)` }, { opacity: 1, transform: 'none' }], { duration: 850, easing: EASE, fill: 'backwards' })
  if (e.matches('.card,.fi')) e.querySelectorAll('.ic,h2,h3,p,.field,.go').forEach(t => t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 220, easing: 'ease-out', fill: 'backwards' })) }
const place = e => { if (inV(e)) { e._on = true; e._t = performance.now(); if (e._n && !e._p) play(e) } else { e._on = false; e.style.opacity = '0' } io.observe(e) }
function startRv() { ready = true
  io = new IntersectionObserver(es => es.forEach(({ target: e, isIntersecting: x }) => {
    if (x && e._on === false) { e._on = true; e.style.opacity = ''; play(e) }
    else if (!x && e._on && performance.now() - e._t > 1300) { e._on = false; e.style.opacity = '0' }
  }), { threshold: .1 })
  ;['.hero>*', '#cari .card', '#hasil .card.empty', '.fi', '.foot', '.dprof', '.dh', '.soc', '.dquote'].forEach(q => $$(q).forEach(e => list.push(e)))
  list.splice(0).forEach(place) }
function rv(e, n, d) { if (rm || !e) return; e._n = n; e._d = d; ready ? place(e) : list.push(e) }
let first = true
const closeIntro = () => {
  if (ig.classList.contains('out')) return
  if (!first) { ig.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }).onfinish = () => { ig.classList.add('out'); h.classList.remove('lk') }; return }
  first = false; const r = bx.getBoundingClientRect(), o = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  ig.classList.add('out'); h.classList.remove('lk', 'hld'); if (!rm) asm(o); setTimeout(startRv, rm ? 0 : 1500)
}
$('#ibd').onclick = $('#ibx').onclick = closeIntro
addEventListener('keydown', e => e.key === 'Escape' && closeIntro())

/* ---------- link ?url= (auto-search) ---------- */
const q = new URLSearchParams(location.search).get('url'), rl = performance.getEntriesByType?.('navigation')[0]?.type === 'reload'
if (q && rl) history.replaceState(null, '', location.pathname)
else if (q) { u.value = q; u.oninput(); search() }

/* ---------- anti-inspect (pencegah ringan, dipertahankan dari project lama) ---------- */
;(() => {
  const b = e => { e.preventDefault(); e.stopImmediatePropagation() }
  document.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && k === 'u')) b(e) }, true)
  document.addEventListener('contextmenu', b, true)
  if (matchMedia('(pointer:coarse)').matches) return
  let d = false, dpr = devicePixelRatio, bw = outerWidth - innerWidth, bh = outerHeight - innerHeight
  setInterval(() => {
    if (devicePixelRatio !== dpr) { dpr = devicePixelRatio; bw = outerWidth - innerWidth; bh = outerHeight - innerHeight; d = false; return }
    if (outerWidth - innerWidth - bw > 160 || outerHeight - innerHeight - bh > 160) { if (!d) { d = true; document.documentElement.innerHTML = "<body style='background:#000;color:#fff;display:grid;place-items:center;height:100vh;font:20px sans-serif'>Developer Tools tidak diizinkan.</body>" } } else d = false
  }, 500)
})()
