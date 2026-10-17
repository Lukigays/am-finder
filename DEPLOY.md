# 🔴 PENYEBAB UTAMA: Deployment dikunci Vercel Authentication

Ini **bukan bug kode**. Deployment kamu (`am-finder-…-lukigays-projects.vercel.app`)
masih di-setting **Protected** oleh Vercel, jadi semua request — termasuk
`/api/find` — dibelokkan (HTTP **302**) ke halaman login Vercel.

Akibatnya browser nerima **HTML** login, bukan JSON → `JSON.parse` gagal →
muncul pesan "Server ngasih respon aneh / Gagal nyari preset".

Bukti (dites langsung ke deployment kamu):

```
GET https://am-finder-o2biabcmp-lukigays-projects.vercel.app/api/ping
→ 302  Location: https://vercel.com/sso-api?url=...
→ body: "Protected by Vercel Authentication"
```

## ✅ Cara matiin (30 detik)

1. Buka <https://vercel.com/dashboard> → pilih project **am-finder**
2. Masuk **Settings** (tab paling kanan)
3. Klik menu **Deployment Protection** (di kolom kiri)
4. Cari bagian **Vercel Authentication**
5. Ganti pilihannya:
   - **Standard Protection** → cuma *preview* yang dikunci, domain production **publik** ✅ (disarankan)
   - atau **Disabled** → semua publik
6. Klik **Save** (tombol di kanan atas)
7. Tunggu ±10–30 detik, lalu refresh web-nya

> Kalau opsinya nggak bisa dipilih (abu-abu), berarti akun kamu di plan yang
> membatasi fitur ini. Pakai **Standard Protection** — itu yang paling umum.

## ✅ Pakai domain yang bener

Di dashboard project, buka menu **Domains**. Domain yang **bukan** URL preview
adalah yang dipakai:

```
❌ am-finder-o2biabcmp-lukigays-projects.vercel.app   ← URL deployment (ada kode acak)
❌ am-finder-git-main-lukigays-projects.vercel.app   ← URL preview branch
✅ am-finder-lukigays-projects.vercel.app            ← domain project (production)
```

URL production inilah yang dibuka di HP. Kalau mau nama yang lebih rapi,
tambahkan domain sendiri di menu Domains.

## 🧪 Tes setelah dimatikan

Buka di browser:

```
https://am-finder-lukigays-projects.vercel.app/api/ping
```

| Hasil | Artinya |
|---|---|
| `{"ok":true,"app":"lukyy","build":"1.4.1",…}` | ✅ beres, cari preset udah jalan |
| Masih `Protected by Vercel Authentication` | protection belum ke-save / masih nempel cache → tunggu 30 detik, hard refresh |
| `404 NOT_FOUND` | folder `api/` nggak ikut ke-deploy |
| HTML error 500 | buka Deployments → Functions → `api/find` buat lihat log |

Lalu tes cari preset:

```
https://am-finder-lukigays-projects.vercel.app/api/find?url=https://www.tiktok.com/@mannnzx_5mb/video/7463965556438306054
```

Harus keluar JSON berisi `"ok":true` dan `"presetLinks"`.

## ℹ️ Kenapa web-nya bisa kebuka padahal API-nya dikunci?

Halaman statis (`index.html`, CSS, JS) kadang masih kebuka lewat browser karena
Vercel Authentication minta login lewat cookie — begitu kamu login, file statis
kebuka, **tapi** `fetch('/api/find')` tetap kena proteksi dan balikin HTML login.
Itu sebabnya layarnya normal tapi pencarian selalu gagal. Kalau kamu buka di HP
yang belum login Vercel, seluruh halamannya bakal minta login dulu.

---

## Kalau `api/find` sendiri yang rusak (bukan protection)

Versi 1.4.0 punya fallback: `vercel.json` me-rewrite `/api/live` langsung ke
`https://amfinder.web.id/api/find`, tanpa serverless function. Frontend otomatis
pindah ke jalur ini kalau `/api/find` balikin HTML/404.

Cek:

```
https://<domain>/api/live?url=https://www.tiktok.com/@mannnzx_5mb/video/7463965556438306054&bat=80&chg=1
```

Kalau keluar teks `event: result` + `data: {...}` → jalur cadangan hidup.

## Deploy ulang lewat CLI

```bash
rm -rf lukyy
unzip lukyy.zip
cd lukyy
npx vercel --prod
```

Buka domain production yang dikasih CLI (bukan URL preview ber-hash), lalu cek:
footer paling bawah harus ada tulisan **`build 1.5.0`**, dan `/api/ping` harus
keluar JSON.
