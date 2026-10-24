import test from 'node:test'
import assert from 'node:assert/strict'

import { scanByTikwm } from '../lib/scanner.js'

const VIDEO_URL = 'https://www.tiktok.com/@owner/video/7463965556438306054'
const json = data => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'content-type': 'application/json' }
})

function mockSources(t, { title, comments = [] }) {
  const calls = []
  t.mock.method(globalThis, 'fetch', async input => {
    const raw = typeof input === 'string' ? input : input.url
    const url = new URL(raw)
    calls.push(url.href)

    if (url.hostname === 'www.tikwm.com' && url.pathname === '/api/') {
      return json({
        code: 0,
        data: {
          id: '7463965556438306054',
          title,
          comment_count: comments.length,
          author: { unique_id: 'owner', nickname: 'Pemilik' }
        }
      })
    }
    if (url.hostname === 'www.tikwm.com' && url.pathname === '/api/comment/list') {
      return json({ code: 0, data: { comments, hasMore: false, total: comments.length } })
    }
    if (/(^|\.)tiktok\.com$/.test(url.hostname)) return new Response('blocked', { status: 403 })
    throw new Error('Request tidak disiapkan dalam tes: ' + url.href)
  })
  return calls
}

test('preset di deskripsi tidak memicu antrean komentar', async t => {
  const calls = mockSources(t, { title: 'Preset https://alight.link/dari-deskripsi' })

  const result = await scanByTikwm(VIDEO_URL)

  assert.equal(result.ok, true)
  assert.equal(result.presets.length, 1)
  assert.equal(result.presets[0].url, 'https://alight.link/dari-deskripsi')
  assert.equal(result.presets[0].source, 'description')
  assert.equal(result.scanned.comments, 0)
  assert.equal(calls.some(url => url.includes('/comment/list')), false)
})

test('komentar tetap dipindai jika deskripsi tidak berisi preset', async t => {
  const calls = mockSources(t, {
    title: 'Cek komentar',
    comments: [{ text: 'Ini https://alight.link/dari-komentar', user: { unique_id: 'owner' }, reply_total: 0 }]
  })

  const result = await scanByTikwm(VIDEO_URL)

  assert.equal(result.ok, true)
  assert.equal(result.presets.length, 1)
  assert.equal(result.presets[0].url, 'https://alight.link/dari-komentar')
  assert.equal(result.presets[0].source, 'comment')
  assert.equal(result.scanned.comments, 1)
  assert.equal(calls.some(url => url.includes('/comment/list')), true)
})
