// Kartu informasi (data + render). Kartu "Free" tampil sebagai bubble/badge.
export const infoCards = [
  { icon: 'bolt', title: 'Serba otomatis', text: 'Preset 5mb (Alight Creative) sama XML (Google Drive, dll) diambil sendiri.' },
  { icon: 'link', title: 'Sampai ke pojok', text: 'Deskripsi, bio, link bio, komentar, sampai balasan komentar ikut diintip.' },
  { icon: 'shield', title: 'Aman & santai', text: 'Nggak perlu akun, nggak ada iklan, nggak ada tracking.' },
  { icon: 'free', title: 'Free', text: 'Semua di eksekusi secara gratis 100% tanpa pungut biaya!', free: true }
]

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function renderInfo(el) {
  el.innerHTML = infoCards.map(c => `<div class="fi${c.free ? ' free' : ''}"><span class="ic"><svg width="20" height="20"><use href="#i-${c.icon}"/></svg></span>${c.free ? '<span class="bub">Free</span>' : ''}<h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join('')
}
