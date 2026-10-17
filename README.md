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
│   ├── find.js           # GET /api/find?url=...  (orkestrator pencarian)
│   └── proxy.js          # proxy video/gambar TikTok (biar bisa diputar/dimuat di web)
├── lib/
│   └── scanner.js        # scanner mandiri (fallback) — TikTok + komentar
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

## Dua mesin pencarian

`api/find.js` itu orkestrator. Urutannya:

### 1. Mesin utama — `amfinder.web.id`

Dipanggil ke:

```
GET https://amfinder.web.id/api/find?url=<link tiktok>&bat=80&chg=1
Accept: text/event-stream
```

Endpoint-nya streaming **SSE**. Event `log` diabaikan, yang dipakai cuma event `result` terakhir (bisa juga datang sebagai JSON biasa). Datanya paling lengkap:

- metadata video + statistik (views/likes/comments/shares) + `playUrlNoWm`
- `authorDetail` (username, nickname, bio, avatar)
- `presetLinks[]` → `type`, `url`, `title`, **`thumb`/`thumbs`**, **`size`**, **`ratio`**, `source`, **`verified`**
- `scanned` (deskripsi/bio/bioLink/comments/replies) dan `context` (hashtag yang match)

Hasilnya dinormalisasi ke kontrak internal frontend (`api/find` -> `data/response.js`), lalu dikirim ke browser.

> Kredit: API & client aslinya karya **Melvin** — <https://t.me/luyatiem> · channel <https://t.me/aboutvin7x>.

### 2. Fallback — `lib/scanner.js`

Kalau mesin utama error/timeout/nggak nemu preset, scanner mandiri jalan sendiri:

1. Link TikTok dinormalkan (link pendek `vt.tiktok.com` di-resolve dulu).
2. Metadata video diambil (deskripsi, cover, statistik, author, bio).
3. Komentar diambil per halaman (cursor) — maks. ±175 komentar + balasan dari thread teramai, dengan batas waktu supaya fungsi nggak timeout.
4. Semua teks (deskripsi, bio, link bio, komentar, balasan) di-scan pakai pola link:
   - **5MB** → `alightcreative.com`, `alight.link`, `alight.motion`
   - **XML** → Google Drive, MediaFire, Mega, Dropbox, sfile, pixeldrain, dll + file `.xml/.zip/.rar`.
5. Link 5MB & file Drive dibuka halaman detailnya buat ambil **nama preset + ukuran MB**.

Response akhir selalu bentuk yang sama:

```json
{ "ok": true, "videoId": "...", "video": {...}, "author": {...},
  "scanned": { "comments": 74, "replies": 0 },
  "presets": [ { "type": "5mb", "url": "...", "title": "...", "thumb": "...",
                 "size": "...", "ratio": "4:5", "source": "description",
                 "verified": true, "byAuthor": true } ],
  "engine": "amfinder" }
```

`engine` = `amfinder` | `scanner`. Kalau fallback dipakai, ada field tambahan `fallbackFrom` berisi alasan mesin utama gagal.

## Endpoint

| Endpoint | Keterangan |
|---|---|
| `GET /api/find?url=<link tiktok>` | Cari preset dari satu video (mesin utama + fallback). Response: JSON di atas. |
| `GET /api/proxy?u=<url gambar/video>` | Nerusin byte dari host yang di-whitelist (TikTok CDN, Firebase Storage, dll). |

## Catatan teknis

- **Tanpa dependency.** `fetch` + Web API di Node runtime Vercel (Node 20+). Batas waktu fungsi 60 detik lewat `vercel.json`.
- **Antrean request.** API publik `tikwm` (dipakai fallback) membatasi 1 request/detik, jadi semua panggilannya lewat satu antrean berjeda ~1,1 detik + retry kalau kena limit.
- **Kalau preset kosong.** Coba lagi beberapa detik kemudian — sumber pihak ketiga kadang nge-limit. Link preset Alight Motion juga sering cuma nongol di **balasan komentar**, makanya fallback ikut ngintip balasan thread paling rame.
- **Video.** `playUrlNoWm` dari TikTok CDN nggak bisa diputar langsung di browser (butuh header Referer), jadi diputer lewat `/api/proxy`. Kalau gagal, frontend otomatis fallback ke tombol "Buka di TikTok".
- **Kredit.** Frontend hasil remake dari project developer sebelumnya (**@Izz / RazeerhDev**), mesin pencarian memakai **amfinder** karya **Melvin**. Semua kredit tetap milik pembuat aslinya — jangan dianggap project resmi dari mereka.
