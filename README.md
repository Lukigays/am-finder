# Lukyy — Preset Finder

Cari preset **Alight Motion** (link 5MB & XML) cuma lewat link TikTok.
Tempel link video → sistem nyari link preset dari **deskripsi, bio, link bio, komentar, sampai balasan komentar**, lengkap sama video (bisa diputar langsung), statistik, thumbnail preset, ukuran, dan rasio.

Gratis, tanpa login, tanpa iklan. UI-nya pakai gaya *Neon Brutalism* + *Liquid Glass*.

---

## Isi project

```
lukyy/
├── index.html            # halaman utama (SPA mini: main + view developer)
├── css/style.css         # semua styling (tanpa framework, tanpa CDN CSS)
├── js/script.js          # logika UI: search, animasi, navigasi, toast, intro
├── data/
│   ├── socials.js        # <- IDENTITAS BRAND & semua link sosial owner
│   ├── info.js           # 4 kartu info di bagian "Info"
│   ├── developer.js      # halaman Developer (nama, foto, quote, sosial)
│   └── response.js       # renderer hasil pencarian
├── api/
│   ├── find.js           # GET /api/find?url=...  (semua logika pencarian ada di sini)
│   └── proxy.js          # proxy video/gambar TikTok (biar bisa diputar/dimuat di web)
├── assets/               # logo Alight Motion, foto dev, og-image
├── vercel.json           # konfigurasi Vercel (maxDuration, cache, cleanUrls)
└── package.json
```

## Deploy ke Vercel

**Cara 1 — lewat CLI (paling cepat)**

```bash
unzip lukyy.zip
cd lukyy
npx vercel        # buat preview
npx vercel --prod # buat production
```

Nama project di Vercel otomatis jadi `lukyy` (sesuai nama folder).

**Cara 2 — lewat dashboard**

1. Buka <https://vercel.com/new>
2. Drag & drop folder `lukyy`, atau push ke repo GitHub lalu import.
3. Framework Preset: **Other**, langsung **Deploy**.

Tanpa build step, tanpa dependency — file statis + 2 Serverless Function.

## Ganti isi (tanpa nyentuh kode tampilan)

| Mau diubah | Edit di |
|---|---|
| Nama brand, tagline, tahun di footer | `data/socials.js` (`BRAND`) + teks di `index.html` |
| Link TikTok / IG / WhatsApp / GitHub owner | `data/socials.js` → `SOCIALS` (kalau `url: ''` item tetap tampil tapi nggak bisa diklik) |
| Konten halaman Developer | `data/developer.js` |
| Kartu info di bagian Info | `data/info.js` |
| Foto developer & logo | ganti `assets/dev.png` dan `assets/logo-am.png` (nama file sama, tinggal timpa) |
| Preview link share (WhatsApp/Twitter) | ganti `assets/og-image.png` (1200×630) |

> Catatan: `SOCIALS` sengaja dikosongin URL-nya biar nggak ada link karangan. Isi link asli owner dulu kalau mau dipakai produksi.

## Cara kerja pencarian (satu sumber: amfinder)

Semua logika ada di **`api/find.js`** — file tunggal, tanpa import file lain, biar aman di-deploy ke Vercel.

Alur:

1. Frontend manggil `GET /api/find?url=<link tiktok>`.
2. Server validasi link-nya (harus `http(s)://` + domain `tiktok.com`), lalu manggil:

   ```
   GET https://amfinder.web.id/api/find?url=<link tiktok>&bat=80&chg=1
   Accept: text/event-stream
   ```

3. Respon amfinder itu **SSE**. Event `log` diabaikan, cuma event `result` terakhir yang dipakai
   (kalau suatu saat dia balikin JSON biasa, itu juga tetap kebaca).
4. Hasilnya dinormalisasi ke bentuk yang dipakai frontend, lalu dikirim sebagai JSON.

Data yang didapat dari amfinder:

- metadata video + statistik (views/likes/comments) + `playUrlNoWm`
- `authorDetail` (username, nickname, bio, avatar)
- `presetLinks[]` → `type`, `url`, `title`, **`thumb`/`thumbs`**, **`size`**, **`ratio`**, `source`, **`verified`**
- `scanned` (jumlah komentar/balasan yang dicek) dan `context` (hashtag yang match)

> Kredit: API & client aslinya karya **Melvin** — <https://t.me/luyatiem> · channel <https://t.me/aboutvin7x> · channel WA <https://whatsapp.com/channel/0029VbDlfld4yltRwFKFL73X>.

Response ke browser selalu bentuk ini:

```json
{ "ok": true, "videoId": "...", "video": {...}, "author": {...},
  "scanned": { "comments": 74, "replies": 0 },
  "presets": [ { "type": "5mb", "url": "...", "title": "...", "thumb": "...",
                 "size": "...", "ratio": "4:5", "source": "description",
                 "verified": true, "byAuthor": true } ],
  "engine": "amfinder" }
```

Kalau gagal, tetap JSON (bukan HTML) dengan `ok: false` + `error` berbahasa Indonesia, contoh:
`{"ok": false, "error": "Itu bukan link TikTok yang lengkap. Contoh yang bener: https://vt.tiktok.com/xxxx"}`.
Jadi frontend pasti nampilin pesan yang jelas, bukan "Server ngasih respon aneh".

## Endpoint

| Endpoint | Keterangan |
|---|---|
| `GET /api/find?url=<link tiktok>` | Cari preset dari satu video lewat API amfinder. Response: JSON di atas. |
| `GET /api/proxy?u=<url gambar/video>` | Nerusin byte dari host yang di-whitelist (TikTok CDN, Firebase Storage, dll). |

## Cek cepat kalau ada error

Buka langsung di browser (ganti linknya):

```
https://<domain-kamu>/api/find?url=https://www.tiktok.com/@mannnzx_5mb/video/7463965556438306054
```

- Kalau muncul JSON berisi `presets` → aman.
- Kalau muncul halaman error Vercel / HTML → buka **Vercel → Project → Deployments → Functions → `api/find`** buat lihat log-nya.
- Link yang dipotong (mis. `https://vt.tikt`) sekarang dibalas pesan: *"Itu bukan link TikTok yang lengkap..."*.

## Catatan teknis

- **Tanpa dependency.** `fetch` + Web API di Node runtime Vercel (Node 20+). Batas waktu fungsi 60 detik lewat `vercel.json`.
- **Timeout ke amfinder** diset 45 detik, dan semua error ditangkap → fungsi nggak pernah crash jadi HTML.
- **Video.** `playUrlNoWm` dari TikTok CDN nggak bisa diputar langsung di browser (butuh header Referer), jadi diputer lewat `/api/proxy`. Kalau gagal, frontend otomatis fallback ke tombol "Buka di TikTok".
- **Kredit.** Frontend hasil remake dari project developer sebelumnya (**@Izz / RazeerhDev**), mesin pencarian memakai **amfinder** karya **Melvin**. Semua kredit tetap milik pembuat aslinya — jangan dianggap project resmi dari mereka.
