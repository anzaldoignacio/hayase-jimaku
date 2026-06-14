import assert from 'node:assert/strict'

import jimaku from '../jimaku.js'

let failures = 0
async function check (name, fn) {
  try {
    await fn()
    console.log(`ok   ${name}`)
  } catch (e) {
    failures++
    console.error(`FAIL ${name}\n     ${e.message}`)
  }
}

await check('single() without apiKey throws a friendly error', async () => {
  await assert.rejects(
    () => jimaku.single({ anilistId: 1, episode: 1, fetch }),
    /API key/
  )
})

await check('single() maps 401 to a friendly error', async () => {
  const fetch401 = async () => new Response('', { status: 401 })
  await assert.rejects(
    () => jimaku.single({ anilistId: 1, episode: 1, fetch: fetch401 }, { apiKey: 'bad' }),
    /rejected the API key/
  )
})

await check('single() maps 429 to a friendly error', async () => {
  const fetch429 = async () => new Response('', { status: 429 })
  await assert.rejects(
    () => jimaku.single({ anilistId: 1, episode: 1, fetch: fetch429 }, { apiKey: 'k' }),
    /rate limit/
  )
})

await check('single() maps network failure to a friendly error', async () => {
  const fetchBoom = async () => { throw new TypeError('fetch failed') }
  await assert.rejects(
    () => jimaku.single({ anilistId: 1, episode: 1, fetch: fetchBoom }, { apiKey: 'k' }),
    /Could not reach/
  )
})

await check('single() returns [] when no entry matches', async () => {
  const fetchEmpty = async () => Response.json([])
  const result = await jimaku.single({ anilistId: 999999999, episode: 1, fetch: fetchEmpty }, { apiKey: 'k' })
  assert.deepEqual(result, [])
})

await check('single() filters to supported files, ranks .ass first, respects maxFiles', async () => {
  const fetchMock = async (url) => {
    if (url.includes('/search')) return Response.json([{ id: 7, name: 'Test' }])
    return Response.json([
      { url: 'https://x/1.srt', name: 'ep1.srt', size: 1 },
      { url: 'https://x/2.ass', name: 'ep1.ass', size: 1 },
      { url: 'https://x/3.zip', name: 'batch.zip', size: 1 },
      { url: 'https://x/4.srt', name: 'ep1.v2.srt', size: 1 }
    ])
  }
  const result = await jimaku.single({ anilistId: 1, episode: 1, fetch: fetchMock }, { apiKey: 'k', maxFiles: 2 })
  assert.equal(result.length, 2)
  assert.equal(result[0].language, 'ep1.ass')
  assert.ok(result.every(r => r.language !== 'batch.zip'))
})

// captures every requested URL; search matches, file queries return empty
function trackingFetch (capturedUrls, files = []) {
  return async (url) => {
    capturedUrls.push(url)
    if (url.includes('/search')) return Response.json([{ id: 7, name: 'Test' }])
    return Response.json(files)
  }
}

await check('single() with episode=0 queries the API with it (valid per spec, used for specials)', async () => {
  const urls = []
  await jimaku.single({ anilistId: 1, episode: 0, fetch: trackingFetch(urls) }, { apiKey: 'k' })
  assert.ok(urls.some(u => u.includes('/files?episode=0')), `files URLs were: ${urls.filter(u => u.includes('/files'))}`)
})

await check('single() with episode=undefined falls back to absoluteEpisodeNumber', async () => {
  const urls = []
  await jimaku.single({ anilistId: 1, episode: undefined, absoluteEpisodeNumber: 150, fetch: trackingFetch(urls) }, { apiKey: 'k' })
  assert.ok(!urls.some(u => u.includes('episode=undefined')), 'should not call API with episode=undefined')
  assert.ok(urls.some(u => u.includes('/files?episode=150')), `files URLs were: ${urls.filter(u => u.includes('/files'))}`)
})

await check('single() with episode=13.5 (recap) skips it and falls back to absoluteEpisodeNumber', async () => {
  const urls = []
  await jimaku.single({ anilistId: 1, episode: 13.5, absoluteEpisodeNumber: 150, fetch: trackingFetch(urls) }, { apiKey: 'k' })
  assert.ok(!urls.some(u => u.includes('episode=13.5')), 'should not call API with episode=13.5')
  assert.ok(urls.some(u => u.includes('/files?episode=150')), `files URLs were: ${urls.filter(u => u.includes('/files'))}`)
})

await check('single() with no valid episode on a movie fetches the unfiltered file list', async () => {
  const urls = []
  const files = [{ url: 'https://x/movie.ass', name: 'movie.ass', size: 1 }]
  const result = await jimaku.single({ anilistId: 1, episode: undefined, episodeCount: 1, fetch: trackingFetch(urls, files) }, { apiKey: 'k' })
  assert.ok(urls.some(u => u.endsWith('/files')), `files URLs were: ${urls.filter(u => u.includes('/files'))}`)
  assert.equal(result.length, 1)
})

await check('single() with no valid episode on a long show returns [] without dumping all files', async () => {
  const urls = []
  const result = await jimaku.single({ anilistId: 1, episode: undefined, episodeCount: 367, fetch: trackingFetch(urls) }, { apiKey: 'k' })
  assert.deepEqual(result, [])
  assert.ok(!urls.some(u => u.includes('/files')), `should not call the files API at all, got: ${urls.filter(u => u.includes('/files'))}`)
})

await check('single() maps 400 to a friendly error about episode numbers', async () => {
  const fetchMock = async (url) => {
    if (url.includes('/search')) return Response.json([{ id: 7, name: 'Test' }])
    return new Response('', { status: 400 })
  }
  await assert.rejects(
    () => jimaku.single({ anilistId: 1, episode: 1, fetch: fetchMock }, { apiKey: 'k' }),
    /episode number/
  )
})

const apiKey = process.env.JIMAKU_API_KEY
if (apiKey) {
  await check('live: test() reaches jimaku.cc', async () => {
    assert.equal(await jimaku.test(), true)
  })

  await check('live: Frieren (anilist 154587) episode 1 returns files', async () => {
    const result = await jimaku.single({ anilistId: 154587, episode: 1, fetch }, { apiKey })
    assert.ok(result.length > 0, 'expected at least one file')
    assert.ok(result[0].url.startsWith('https://'))
    console.log(`     got ${result.length} file(s), first: ${result[0].language}`)
  })
} else {
  console.log('skip live API checks (set JIMAKU_API_KEY to enable)')
}

process.exit(failures ? 1 : 0)
