import test from 'node:test'
import assert from 'node:assert/strict'

import { amfinder, findWithFallback, formatResult } from '../api/find.js'

const VIDEO_URL = 'https://www.tiktok.com/@owner/video/7463965556438306054'
const PRESET_URL = 'https://alight.link/example'

const scannerResult = () => ({
  ok: true,
  videoId: '7463965556438306054',
  video: {
    id: '7463965556438306054',
    url: VIDEO_URL,
    src: '/api/proxy?u=video',
    views: 1200,
    likes: 80,
    comments: 12,
    description: 'Preset di komentar'
  },
  author: { uniqueId: 'owner', nickname: 'Pemilik', bio: 'Bio' },
  scanned: { comments: 12, replies: 3 },
  presets: [{
    type: '5mb',
    url: PRESET_URL,
    title: 'Preset contoh',
    source: 'comment',
    byAuthor: true,
    pinned: true
  }]
})

test('hasil mesin utama yang berisi preset tidak memanggil fallback', async () => {
  const primaryResult = { ok: true, presetLinks: [{ url: PRESET_URL }] }
  let fallbackCalled = false

  const result = await findWithFallback(VIDEO_URL, {
    primary: async () => primaryResult,
    fallback: async () => { fallbackCalled = true; return scannerResult() }
  })

  assert.strictEqual(result, primaryResult)
  assert.equal(fallbackCalled, false)
})

test('HTTP 403 dari amfinder otomatis memakai scanner mandiri', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"security token required"}', {
    status: 403,
    headers: { 'content-type': 'application/json' }
  }))
  let fallbackCalled = false

  const result = await findWithFallback(VIDEO_URL, {
    primary: amfinder,
    fallback: async (url, options) => {
      fallbackCalled = true
      assert.equal(url, VIDEO_URL)
      assert.ok(options.budgetMs >= 8000)
      return scannerResult()
    }
  })

  assert.equal(fallbackCalled, true)
  assert.equal(result.ok, true)
  assert.equal(result.engine, 'scanner')
  assert.equal(result.fallbackFrom, 'HTTP 403')
  assert.equal(result.presets[0].url, PRESET_URL)
})

test('hasil kosong yang valid tetap dikembalikan jika scanner cadangan gagal', async () => {
  const emptyResult = { ok: true, videoId: '123', presetLinks: [] }

  const result = await findWithFallback(VIDEO_URL, {
    primary: async () => emptyResult,
    fallback: async () => { throw new Error('sumber sedang dibatasi') }
  })

  assert.strictEqual(result, emptyResult)
})

test('kegagalan kedua mesin menjelaskan penyebab utama dan cadangan', async () => {
  const result = await findWithFallback(VIDEO_URL, {
    primary: async () => ({ status: false, message: 'HTTP 403' }),
    fallback: async () => { throw new Error('TikWM timeout.') }
  })

  assert.equal(result.status, false)
  assert.match(result.message, /Mesin utama: HTTP 403/)
  assert.match(result.message, /Scanner cadangan: TikWM timeout\./)
})

test('formatResult mempertahankan data author, statistik, dan preset scanner', () => {
  const result = formatResult({ ...scannerResult(), engine: 'scanner', fallbackFrom: 'HTTP 403' }, VIDEO_URL)

  assert.equal(result.ok, true)
  assert.equal(result.engine, 'scanner')
  assert.equal(result.fallbackFrom, 'HTTP 403')
  assert.equal(result.author.uniqueId, 'owner')
  assert.equal(result.authorDetail.nickname, 'Pemilik')
  assert.equal(result.video.stats.views, 1200)
  assert.equal(result.video.stats.likes, 80)
  assert.equal(result.video.stats.comments, 12)
  assert.equal(result.video.src, '/api/proxy?u=video')
  assert.equal(result.presets.length, 1)
  assert.equal(result.presets[0].byAuthor, true)
  assert.equal(result.presets[0].pinned, true)
  assert.deepEqual(result.presetLinks, result.presets)
})

test('formatResult tetap mem-proxy video dari format amfinder', () => {
  const raw = {
    ok: true,
    videoId: '123456',
    video: { playUrlNoWm: 'https://cdn.example/video.mp4?a=1&b=2', stats: { views: 9 } },
    authorDetail: { uniqueId: 'author' },
    presetLinks: [{ type: '5mb', url: PRESET_URL, source: 'description' }]
  }

  const result = formatResult(raw, VIDEO_URL)

  assert.equal(result.engine, 'amfinder')
  assert.equal(result.video.src, '/api/proxy?u=' + encodeURIComponent(raw.video.playUrlNoWm))
  assert.equal(result.video.stats.views, 9)
  assert.equal(result.presets[0].byAuthor, true)
  assert.equal(raw.video.src, undefined, 'input tidak boleh dimutasi')
})
