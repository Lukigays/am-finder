import { SOCIALS } from './socials.js'

// Data identitas developer + render halaman Developer.
export const developer = {
  name: 'Lukyy',
  verified: true,
  image: 'assets/dev.png',
  description: 'Independent developer, Solo developer, and Self-Employed developer.',
  links: [SOCIALS.tiktok, SOCIALS.instagram, SOCIALS.whatsappOwner, SOCIALS.github],
  quote: 'Bikin tools yang simpel, kepake buat banyak orang.',
  quoteLabel: 'Kata-kata dari saya'
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function renderDeveloper(el) {
  const d = developer
  el.innerHTML = `
  <div class="dprof">
    <div class="pf"><img src="${esc(d.image)}" alt="Foto ${esc(d.name)}" width="520" height="520" decoding="async"><span class="glass">Developer</span></div>
    <div>
      <h2 class="dname"><span>${esc(d.name)}</span><svg class="ver" viewBox="0 0 24 24" role="img" aria-label="Terverifikasi"><use href="#i-ver"/></svg></h2>
      <p class="ddesc">${esc(d.description)}</p>
    </div>
  </div>
  <h3 class="dh">Media sosial</h3>
  <div class="dsoc">${d.links.map(l => l.url
    ? `<a class="soc s-${esc(l.id)}" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="sq"><svg width="22" height="22"><use href="#i-${esc(l.icon)}"/></svg></span><span class="st"><b>${esc(l.label)}</b><span>${esc(l.handle)}</span></span></a>`
    : `<a class="soc s-${esc(l.id)}" href="#" data-na aria-disabled="true"><span class="sq"><svg width="22" height="22"><use href="#i-${esc(l.icon)}"/></svg></span><span class="st"><b>${esc(l.label)}</b><span>${esc(l.handle)}</span></span></a>`).join('')}</div>
  <figure class="dquote"><figcaption>${esc(d.quoteLabel)}</figcaption><blockquote><span class="qm" aria-hidden="true">&ldquo;</span>${esc(d.quote)}</blockquote></figure>`
}
