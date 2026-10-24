/**
 * Judul : Lukyy Preset Finder
 * Author : Lukyy
 * GitHub : https://github.com/Lukigays
 * TikTok : https://www.tiktok.com/@user24102008777
 * Instagram : https://www.instagram.com/_24lukyy
 * Saluran WhatsApp : https://whatsapp.com/channel/0029VbB9vRs2UPBANLLA2o0p
 *
 * Deskripsi : Mencari preset Alight Motion melalui URL TikTok atau kata kunci.
 * Base URL : https://amfinder.web.id (endpoint publik yang dipakai buat nyari)
 */

'use strict'

import { scanByTikwm } from '../lib/scanner.js'

const BASE = 'https://amfinder.web.id'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
const HEADERS = {
	Accept: 'text/event-stream',
	'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
	Referer: `${BASE}/`,
	'User-Agent': UA
}

async function requestSSE(url) {
	// Sisakan waktu untuk scanner cadangan sebelum batas function 60 detik.
	const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(28000) })
	if (!response.ok) throw new Error(`HTTP ${response.status}`)
	if (!response.body) throw new Error('Response stream tidak tersedia')

	const reader = response.body.getReader(), decoder = new TextDecoder(), events = []
	let buffer = ''

	const parseBlock = block => {
		let event = 'message'
		const lines = []
		for (const line of block.split(/\r?\n/)) {
			if (line.startsWith('event:')) event = line.slice(6).trim()
			else if (line.startsWith('data:')) lines.push(line.slice(5).trim())
		}
		if (!lines.length) return
		const raw = lines.join('\n')
		let data
		try { data = JSON.parse(raw) } catch { data = raw }
		events.push({ event, data })
	}

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })
			const blocks = buffer.split(/\r?\n\r?\n/)
			buffer = blocks.pop() || ''
			for (const block of blocks) parseBlock(block)
		}
		buffer += decoder.decode()
		if (buffer.trim()) parseBlock(buffer)
	} finally {
		reader.releaseLock()
	}
	return events
}

function getFinalResult(events) {
	for (let i = events.length - 1; i >= 0; i--) {
		const data = events[i].data
		if (data && typeof data === 'object' && 'ok' in data) return data
	}
	return null
}

async function amfinder(targetUrl) {
	try {
		targetUrl = String(targetUrl || '').trim()
		if (!targetUrl) return { status: false, message: 'URL TikTok tidak boleh kosong' }
		if (!/^https?:\/\//i.test(targetUrl)) return { status: false, message: 'URL harus menggunakan HTTP atau HTTPS' }

		const events = await requestSSE(`${BASE}/api/find?url=${encodeURIComponent(targetUrl)}&bat=80&chg=1`)
		const result = getFinalResult(events)
		return result || { status: false, message: 'Tidak ada hasil akhir diterima' }
	} catch (error) {
		return { status: false, message: error.message }
	}
}

async function searchPreset(query) {
	try {
		query = String(query || '').trim()
		if (!query) return { status: false, message: 'Kata kunci pencarian tidak boleh kosong' }

		const events = await requestSSE(`${BASE}/api/search?mode=pick&q=${encodeURIComponent(query)}`)
		const result = getFinalResult(events)
		const candidateData = events.find(item => item.event === 'candidates')?.data
		const items = Array.isArray(candidateData?.items) ? candidateData.items : []

		if (!result && !candidateData) return { status: false, message: 'Server tidak mengembalikan hasil pencarian' }

		return {
			status: result?.ok === false ? false : true,
			query,
			engine: candidateData?.engine || result?.engine || null,
			fromCache: candidateData?.fromCache ?? result?.fromCache ?? null,
			total: result?.candidates ?? items.length,
			items,
			result: result || null,
			events: events.filter(item => !['candidates', 'result'].includes(item.event))
		}
	} catch (error) {
		return { status: false, message: error.message }
	}
}

/* ========================================================================== */
/*  Handler Vercel — GET /api/find?url=<link TikTok>  atau  ?q=<kata kunci>   */
/*  Pencarian URL memakai amfinder, lalu scanner mandiri kalau mesin utama    */
/*  tidak bisa diakses atau tidak menemukan preset. Response selalu JSON.     */
/* ========================================================================== */

const LIMIT = 52000 // di bawah maxDuration Vercel (60 detik)
const BUDGET = 46000 // mesin utama + scanner cadangan

function send(res, code, obj) {
	try {
		res.statusCode = code
		res.setHeader('content-type', 'application/json; charset=utf-8')
		res.setHeader('cache-control', 'no-store')
		res.end(JSON.stringify(obj))
	} catch {
		res.end('{"ok":false,"error":"gagal kirim response"}')
	}
}

// video TikTok CDN butuh header Referer -> diputer lewat /api/proxy
function withPlayableVideo(result) {
	if (!result || !result.video) return result
	const play = result.video.playUrlNoWm || result.video.playUrl || ''
	if (play) {
		result.video.src = '/api/proxy?u=' + encodeURIComponent(play)
		result.video.proxy = result.video.src
		result.video.srcFrom = 'amfinder → tiktok-cdn (via proxy)'
	}
	return result
}

const hasPresets = result => {
	const links = Array.isArray(result?.presetLinks) ? result.presetLinks : result?.presets
	return Array.isArray(links) && links.some(p => p?.url)
}

// amfinder sekarang bisa menolak request server (mis. HTTP 403). Jangan langsung
// oper error itu ke pengguna: scan sumber publik sendiri lewat lib/scanner.js.
// Dependency injection di options dipakai tes regresi tanpa memanggil jaringan.
async function findWithFallback(url, { primary = amfinder, fallback = scanByTikwm, budgetMs = BUDGET } = {}) {
	const started = Date.now()
	let primaryResult = null
	let reason = 'mesin utama tidak memberi hasil'

	try {
		primaryResult = await primary(url)
	} catch (error) {
		reason = error?.message || reason
	}

	const primaryOk = primaryResult && primaryResult.status !== false && primaryResult.ok !== false
	if (primaryOk && hasPresets(primaryResult)) return primaryResult
	if (primaryOk) reason = 'preset tidak ditemukan di mesin utama'
	else reason = primaryResult?.message || primaryResult?.error || reason

	const left = Math.max(8000, budgetMs - (Date.now() - started))
	try {
		const result = await fallback(url, { budgetMs: left })
		if (!result || result.ok === false) {
			throw new Error(result?.message || result?.error || 'scanner tidak memberi hasil')
		}
		return { ...result, ok: true, engine: 'scanner', fallbackFrom: reason }
	} catch (error) {
		// Kalau mesin utama berhasil tetapi memang kosong, pertahankan hasil validnya
		// saat scanner cadangan ikut gagal.
		if (primaryOk) return primaryResult
		const fallbackReason = String(error?.message || 'error').replace(/\.+$/, '')
		return { status: false, message: `Mesin utama: ${reason}. Scanner cadangan: ${fallbackReason}.` }
	}
}

// Satukan kontrak hasil amfinder (presetLinks/authorDetail) dan scanner mandiri
// (presets/author) agar keduanya bisa dirender oleh frontend yang sama.
function formatResult(result, url) {
	const out = withPlayableVideo({ ...result, video: { ...(result.video || {}) } })
	const legacyAuthor = result.author && typeof result.author === 'object' ? result.author : {}
	const authorDetail = result.authorDetail && typeof result.authorDetail === 'object' ? result.authorDetail : {}
	const a = { ...legacyAuthor, ...authorDetail }
	const authorName = typeof result.author === 'string' ? result.author.replace(/^@/, '') : ''
	const rawPresets = Array.isArray(result.presetLinks)
		? result.presetLinks
		: Array.isArray(result.presets) ? result.presets : []

	out.ok = true
	out.engine = result.engine || 'amfinder'
	out.video = {
		...out.video,
		id: result.videoId || out.video.id || '',
		url: result.videoUrl || out.video.url || url,
		embed: `https://www.tiktok.com/embed/v2/${result.videoId || out.video.id || ''}`,
		description: out.video.description || '',
		cover: out.video.cover || a.avatar || null,
		stats: out.video.stats || {
			views: out.video.views ?? 0,
			likes: out.video.likes ?? 0,
			comments: out.video.comments ?? 0
		},
		src: out.video.src || null,
		proxy: out.video.proxy || null,
		srcFrom: out.video.srcFrom || null
	}
	out.author = {
		uniqueId: a.uniqueId || a.username || authorName,
		nickname: a.nickname || '',
		avatar: a.avatar || out.video.cover || null,
		bio: a.bio || '',
		bioLink: a.bioLink || ''
	}
	if (!result.authorDetail) out.authorDetail = out.author
	out.scanned = result.scanned || { comments: 0, replies: 0 }
	out.presets = rawPresets.filter(p => p?.url).map(p => ({
		type: p.type === '5mb' ? '5mb' : 'xml',
		url: p.url,
		title: p.title || (p.type === '5mb' ? 'Preset Alight Motion' : 'File preset XML'),
		thumb: p.thumb || (Array.isArray(p.thumbs) ? p.thumbs[0] : '') || '',
		size: p.size || '',
		ratio: p.ratio || '',
		source: p.source || 'comment',
		verified: !!p.verified,
		byAuthor: typeof p.byAuthor === 'boolean' ? p.byAuthor : ['description', 'bio', 'bioLink'].includes(p.source),
		detail: p.detail || '',
		pinned: !!p.pinned
	}))
	if (!Array.isArray(out.presetLinks)) out.presetLinks = out.presets
	return out
}

function findByKeyword(query) {
	return searchPreset(query).then(out => {
		if (!out || out.status === false) {
			return { ok: false, error: out?.message || 'Pencarian kata kunci gagal' }
		}
		return {
			ok: true,
			engine: 'amfinder',
			query: out.query,
			total: out.total,
			items: out.items,
			presets: (out.items || []).map(it => ({
				title: it.title || it.desc || '',
				url: it.url || '',
				type: '5mb',
				thumb: it.thumb || it.cover || '',
				author: it.author || it.username || '',
				source: 'keyword'
			}))
		}
	})
}

export default async function handler(req, res) {
	let url = ''
	let query = ''

	try {
		const u = new URL(req.url, 'http://localhost')
		url = (u.searchParams.get('url') || '').trim()
		query = (u.searchParams.get('q') || '').trim()
	} catch {
		return send(res, 200, { ok: false, error: 'Request nggak kebaca.' })
	}

	// mode kata kunci (opsional, pakai searchPreset dari amfinder)
	if (!url && query) {
		try {
			const out = await Promise.race([
				findByKeyword(query),
				new Promise(r => setTimeout(() => r({ ok: false, error: 'amfinder kelamaan jawab (timeout). Coba lagi ya.' }), LIMIT))
			])
			return send(res, 200, out)
		} catch (e) {
			return send(res, 200, { ok: false, error: 'Gagal cari kata kunci: ' + (e?.message || 'error') })
		}
	}

	if (!url) return send(res, 200, { ok: false, error: 'Link TikTok-nya belum diisi.' })

	// validasi bentuk link — biar nggak nembak amfinder pakai link kepotong
	if (!/^https?:\/\//i.test(url)) {
		return send(res, 200, { ok: false, error: 'Link harus diawali https:// ya. Contoh: https://vt.tiktok.com/xxxx' })
	}
	let host = ''
	try { host = new URL(url).hostname.toLowerCase() } catch { /* di bawah */ }
	if (!/(^|\.)tiktok\.com$/i.test(host)) {
		return send(res, 200, {
			ok: false,
			error: 'Itu bukan link TikTok yang lengkap. Contoh: https://vt.tiktok.com/xxxx atau https://www.tiktok.com/@user/video/123'
		})
	}

	try {
		const result = await Promise.race([
			findWithFallback(url),
			new Promise(r => setTimeout(() => r({ __timeout: true }), LIMIT))
		])

		if (result?.__timeout) {
			return send(res, 200, { ok: false, error: 'Server pencarian kelamaan jawab (timeout). Coba lagi ya.' })
		}
		if (!result) {
			return send(res, 200, { ok: false, error: 'amfinder nggak ngasih hasil. Coba lagi sebentar ya.' })
		}
		if (result.status === false) {
			return send(res, 200, { ok: false, error: result.message || 'Gagal nyari preset.' })
		}
		if (result.ok === false) {
			return send(res, 200, { ok: false, error: result.message || result.error || 'Preset nggak ketemu.' })
		}

		return send(res, 200, formatResult(result, url))
	} catch (e) {
		return send(res, 200, { ok: false, error: 'Gagal nyambung ke amfinder: ' + (e?.message || 'error') })
	}
}

export { amfinder, searchPreset, requestSSE, getFinalResult, findWithFallback, formatResult }
