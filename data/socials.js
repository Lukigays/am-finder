// ============================================================
//  KONFIGURASI BRAND — cukup ubah file ini buat ganti identitas.
// ============================================================
export const BRAND = {
  name: 'Lukyy',
  tagline: 'Preset Finder',
  year: 2026
}

// Sumber tunggal data sosial: dipakai menu hamburger (js/script.js) dan halaman Developer (data/developer.js).
// url kosong = belum diisi. Item tetap tampil tapi nggak bisa diklik (nggak ada URL karangan).
export const SOCIALS = {
  whatsappChannel: {
    id: 'wa-channel', icon: 'wa', label: 'Channel WhatsApp', sub: 'Info update & preset terbaru',
    url: '' // TODO: isi link channel WhatsApp (https://whatsapp.com/channel/...)
  },
  tiktok: {
    id: 'tiktok', icon: 'tt', label: 'TikTok', handle: '@lukyy',
    url: '' // TODO: isi, contoh: https://www.tiktok.com/@username
  },
  instagram: {
    id: 'instagram', icon: 'ig', label: 'Instagram', handle: '@lukyy',
    url: '' // TODO: isi, contoh: https://www.instagram.com/username
  },
  whatsappOwner: {
    id: 'wa-owner', icon: 'wa', label: 'WhatsApp', handle: 'Contact owner',
    url: '' // TODO: isi, contoh: https://wa.me/62xxxxxxxxxx
  },
  github: {
    id: 'github', icon: 'gh', label: 'GitHub', handle: 'Repo owner',
    url: '' // TODO: isi, contoh: https://github.com/username
  }
}

// Menu hamburger (urutan tampil). `view` = pindah halaman di dalam frontend, tanpa reload.
export const menuItems = [
  { ...SOCIALS.whatsappChannel },
  { id: 'tiktok', icon: 'tt', label: 'TikTok', sub: SOCIALS.tiktok.handle, url: SOCIALS.tiktok.url },
  { id: 'developer', icon: 'code', label: 'Developer', sub: 'Profil & kontak owner', view: 'dev' }
]
