// Free word associations from Datamuse (https://www.datamuse.com/api/). No key needed.
// Only one keyword is ever sent, never the whole idea. Results are treated as untrusted text.

export type DatamuseRelation = 'related' | 'opposite' | 'described'

const PARAM: Record<DatamuseRelation, string> = {
  related: 'rel_trg', // words people associate with it
  opposite: 'rel_ant', // antonyms
  described: 'rel_jjb', // adjectives often used with it
}

const API = 'https://api.datamuse.com/words'
const TIMEOUT_MS = 3000

// Plain lowercase words only, so nothing odd from the API ever reaches the board.
const SAFE_WORD = /^[a-z][a-z' -]{0,30}$/

export async function fetchWords(
  relation: DatamuseRelation,
  keyword: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const url = `${API}?${PARAM[relation]}=${encodeURIComponent(keyword)}&max=20`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    if (!response.ok) return []
    const data: unknown = await response.json()
    if (!Array.isArray(data)) return []
    return data
      .map((item) => (typeof item?.word === 'string' ? item.word.toLowerCase() : ''))
      .filter((word) => SAFE_WORD.test(word) && word !== keyword.toLowerCase())
  } catch {
    // Offline, slow or blocked: the caller falls back to a hand-written nudge.
    return []
  } finally {
    clearTimeout(timer)
  }
}
