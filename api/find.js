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

const BASE = 'https://amfinder.web.id'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
const HEADERS = {
	Accept: 'text/event-stream',
	'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
	Referer: `${BASE}/`,
	'User-Agent': UA
}

async function requestSSE(url) {
	const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) })
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
/*  Bagian di bawah ini cuma "pembungkus": manggil fungsi di atas, lalu ngasih */
/*  JSON ke frontend. Semua logika pencarian tetap 100% kode amfinder di atas. */
/* ========================================================================== */

const LIMIT = 52000 // di bawah maxDuration Vercel (60 detik)

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
			amfinder(url),
			new Promise(r => setTimeout(() => r({ __timeout: true }), LIMIT))
		])

		if (result?.__timeout) {
			return send(res, 200, { ok: false, error: 'amfinder kelamaan jawab (timeout). Coba lagi ya.' })
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

		// hasil amfinder dikirim apa adanya + field tambahan buat frontend
		const out = withPlayableVideo({ ...result })
		out.ok = true
		out.engine = 'amfinder'
		out.video = {
			...(result.video || {}),
			id: result.videoId || result.video?.id || '',
			url: result.videoUrl || result.video?.url || url,
			embed: `https://www.tiktok.com/embed/v2/${result.videoId || result.video?.id || ''}`,
			description: result.video?.description || '',
			cover: result.video?.cover || result.authorDetail?.avatar || null,
			stats: result.video?.stats || {},
			src: result.video?.src || null,
			proxy: result.video?.proxy || null,
			srcFrom: result.video?.srcFrom || null
		}
		out.author = {
			uniqueId: result.authorDetail?.uniqueId || String(result.author || '').replace(/^@/, ''),
			nickname: result.authorDetail?.nickname || '',
			avatar: result.authorDetail?.avatar || out.video.cover || null,
			bio: result.authorDetail?.bio || '',
			bioLink: result.authorDetail?.bioLink || ''
		}
		out.scanned = result.scanned || { comments: 0, replies: 0 }
		out.presets = (result.presetLinks || []).map(p => ({
			type: p.type === '5mb' ? '5mb' : 'xml',
			url: p.url,
			title: p.title || (p.type === '5mb' ? 'Preset Alight Motion' : 'File preset XML'),
			thumb: p.thumb || (Array.isArray(p.thumbs) ? p.thumbs[0] : '') || '',
			size: p.size || '',
			ratio: p.ratio || '',
			source: p.source || 'comment',
			verified: !!p.verified,
			byAuthor: ['description', 'bio', 'bioLink'].includes(p.source)
		}))

		return send(res, 200, out)
	} catch (e) {
		return send(res, 200, { ok: false, error: 'Gagal nyambung ke amfinder: ' + (e?.message || 'error') })
	}
}

export { amfinder, searchPreset, requestSSE, getFinalResult }
