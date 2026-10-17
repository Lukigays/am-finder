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
    id: 'wa-channel', icon: 'wa', label: 'Saluran WhatsApp', sub: 'Info update & preset terbaru',
    url: 'https://whatsapp.com/channel/0029VbB9vRs2UPBANLLA2o0p'
  },
  tiktok: {
    id: 'tiktok', icon: 'tt', label: 'TikTok', handle: '@user24102008777',
    url: 'https://www.tiktok.com/@user24102008777'
  },
  instagram: {
    id: 'instagram', icon: 'ig', label: 'Instagram', handle: '@_24lukyy',
    url: 'https://www.instagram.com/_24lukyy'
  },
  whatsappOwner: {
    id: 'wa-owner', icon: 'wa', label: 'Saluran WhatsApp', handle: 'Ikuti salurannya',
    url: 'https://whatsapp.com/channel/0029VbB9vRs2UPBANLLA2o0p'
  },
  github: {
    id: 'github', icon: 'gh', label: 'GitHub', handle: 'Lukigays',
    url: 'https://github.com/Lukigays'
  }
}

// Menu hamburger (urutan tampil). `view` = pindah halaman di dalam frontend, tanpa reload.
export const menuItems = [
  { ...SOCIALS.whatsappChannel },
  { id: 'tiktok', icon: 'tt', label: 'TikTok', sub: SOCIALS.tiktok.handle, url: SOCIALS.tiktok.url },
  { id: 'developer', icon: 'code', label: 'Developer', sub: 'Profil & kontak owner', view: 'dev' }
]
