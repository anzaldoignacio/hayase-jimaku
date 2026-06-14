const API = 'https://jimaku.cc/api'
const SUPPORTED_EXT = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'txt']

async function request (fetchFn, url, apiKey) {
  let res
  try {
    res = await fetchFn(url, { headers: { Authorization: apiKey } })
  } catch (e) {
    throw new Error('Could not reach jimaku.cc. Check your internet connection, or the site may be down.')
  }
  if (res.ok) return await res.json()
  switch (res.status) {
    case 400:
      throw new Error('jimaku.cc rejected the episode number for this file. Recaps, specials and batch releases sometimes have numbering jimaku cannot match.')
    case 401:
      throw new Error('jimaku.cc rejected the API key. Open the Jimaku extension settings and paste a valid key from jimaku.cc → Account → Generate API key.')
    case 404:
      throw new Error('jimaku.cc has no entry for this anime.')
    case 429:
      throw new Error('jimaku.cc rate limit reached. Wait a moment and try again.')
    default:
      throw new Error(`jimaku.cc returned an unexpected error (HTTP ${res.status}).`)
  }
}

/** @param {unknown} value */
function toValidEpisode (value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 0 ? /** @type {number} */ (value) : null
}

/** @param {string} name */
function isSupportedFile (name) {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  return SUPPORTED_EXT.includes(ext)
}

const FORMAT_RANK = { ass: 0, ssa: 1, srt: 2, vtt: 3, sub: 4, txt: 5 }

/** @param {Array<{url: string, name: string, size: number}>} files */
function sortByFormat (files) {
  return files.slice().sort((a, b) => {
    const ea = FORMAT_RANK[a.name.slice(a.name.lastIndexOf('.') + 1).toLowerCase()] ?? 9
    const eb = FORMAT_RANK[b.name.slice(b.name.lastIndexOf('.') + 1).toLowerCase()] ?? 9
    return ea - eb
  })
}

export default new class Jimaku {
  async single (query, options = {}) {
    const apiKey = (options.apiKey ?? '').trim()
    if (!apiKey) {
      throw new Error('Jimaku needs an API key. Create one for free at jimaku.cc → Account → Generate API key, then paste it in the Jimaku extension settings.')
    }
    if (!query.anilistId) return []

    const entries = await request(query.fetch, `${API}/entries/search?anilist_id=${query.anilistId}`, apiKey)
    if (!Array.isArray(entries) || !entries.length) return []

    const entry = entries[0]

    const episode = toValidEpisode(query.episode)
    const absolute = toValidEpisode(query.absoluteEpisodeNumber)

    let files = []
    if (episode !== null) {
      files = await request(query.fetch, `${API}/entries/${entry.id}/files?episode=${episode}`, apiKey)
    }

    if (!files.length && absolute !== null && absolute !== episode) {
      files = await request(query.fetch, `${API}/entries/${entry.id}/files?episode=${absolute}`, apiKey)
    }

    if (!files.length && (query.episodeCount === 1 || episode === 1)) {
      files = await request(query.fetch, `${API}/entries/${entry.id}/files`, apiKey)
    }

    const maxFiles = Number(options.maxFiles) > 0 ? Number(options.maxFiles) : 5

    return sortByFormat(files.filter(file => isSupportedFile(file.name)))
      .slice(0, maxFiles)
      .map(file => ({ url: file.url, language: file.name }))
  }

  async test () {
    try {
      await fetch('https://jimaku.cc/', { method: 'HEAD' })
      return true
    } catch (e) {
      throw new Error('Could not reach jimaku.cc. Check your internet connection, or the site may be down.')
    }
  }
}()
