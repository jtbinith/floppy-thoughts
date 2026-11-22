// Our own word data for nudges, built from open datasets (ConceptNet and wordfreq) by
// scripts/build-words.py. Nothing is sent anywhere: the files are part of the site, one per first
// letter, fetched only when a nudge needs that letter and kept in the browser's cache, so nudges
// keep working offline once a letter has been used.

// How a word is linked to others. The files list each relation strongest first.
export type Relation = 'related' | 'opposite' | 'described' | 'usedFor' | 'foundAt' | 'parts' | 'kindOf' | 'canDo'
export type WordLinks = Partial<Record<Relation, string[]>>
type Letter = Record<string, WordLinks>

const CACHE = 'floppy-words-v1'
const loaded = new Map<string, Promise<Letter>>()

// Plain lowercase words only, so nothing odd ever reaches the board.
const SAFE = /^[a-z][a-z' -]{0,40}$/

const fileFor = (letter: string) => `${import.meta.env.BASE_URL}words/${letter}.json`

async function fetchLetter(letter: string, fetchImpl: typeof fetch): Promise<Letter> {
  const url = fileFor(letter)
  // The browser's Cache Storage keeps a copy, so a letter used once works offline after.
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => null) : null
  try {
    const response = await fetchImpl(url)
    if (!response.ok) throw new Error(String(response.status))
    if (cache) void cache.put(url, response.clone()).catch(() => {})
    return (await response.json()) as Letter
  } catch {
    const kept = cache ? await cache.match(url) : undefined
    return kept ? ((await kept.json()) as Letter) : {}
  }
}

export function letterFile(letter: string, fetchImpl: typeof fetch = fetch): Promise<Letter> {
  if (!/^[a-z]$/.test(letter)) return Promise.resolve({})
  let file = loaded.get(letter)
  if (!file) {
    file = fetchLetter(letter, fetchImpl)
    loaded.set(letter, file)
    // A failed load isn't kept, so the next nudge tries again.
    void file.then((f) => Object.keys(f).length || loaded.delete(letter))
  }
  return file
}

// The forms of a word to look for: "clocks" → clock, "cities" → city, "boxes" → box.
export function formsOf(word: string): string[] {
  const w = word.toLowerCase()
  const forms = [w]
  if (w.endsWith('ies') && w.length > 4) forms.push(w.slice(0, -3) + 'y')
  if (w.endsWith('es') && w.length > 3) forms.push(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) forms.push(w.slice(0, -1))
  return [...new Set(forms)]
}

// A word's links, under the first of its forms that's in the data, or null if none is.
export async function linksOf(word: string, fetchImpl: typeof fetch = fetch): Promise<{ word: string; links: WordLinks } | null> {
  for (const form of formsOf(word)) {
    const file = await letterFile(form[0], fetchImpl)
    const links = file[form]
    if (links) return { word: form, links: clean(links) }
  }
  return null
}

const clean = (links: WordLinks): WordLinks =>
  Object.fromEntries(Object.entries(links).map(([k, v]) => [k, (v ?? []).filter((w) => SAFE.test(w))])) as WordLinks

// Forgets loaded letters (for tests).
export const forgetLetters = () => loaded.clear()
