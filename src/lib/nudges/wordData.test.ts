import { describe, expect, it } from 'vitest'
import blocklist from '../../../scripts/words-blocklist.txt?raw'
import groups from '../../../scripts/words-groups.txt?raw'

// The real word files in public/words, checked as they ship.
const raw = import.meta.glob('../../../public/words/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const files = Object.entries(raw).map(([path, text]) => ({ name: path.split('/').pop()!, text }))
const listed = (text: string) =>
  text
    .split('\n')
    .map((l) => l.split('#')[0].trim().toLowerCase())
    .filter(Boolean)
const blocked = new Set([...listed(blocklist), ...listed(groups)])
type Words = Record<string, Record<string, string[]>>

describe('the word files', () => {
  it('are small files, one per first two letters', () => {
    expect(files.length).toBeGreaterThan(200)
    for (const f of files) expect(f.name).toMatch(/^[a-z]{2}\.json$/)
    for (const f of files) expect(f.text.length, f.name).toBeLessThan(250_000)
  })

  it('never have a blocked word, or a word for a group of people, as a word or in a link', () => {
    for (const { name: f, text } of files) {
      const words = JSON.parse(text) as Words
      for (const [word, links] of Object.entries(words)) {
        expect(blocked.has(word), `${word} in ${f}`).toBe(false)
        for (const targets of Object.values(links))
          for (const t of targets) expect(t.split(' ').some((w) => blocked.has(w)) || blocked.has(t), `${word} → ${t}`).toBe(false)
      }
    }
  })

  it('only hold plain lowercase words', () => {
    for (const { text } of files) {
      const words = JSON.parse(text) as Words
      for (const [word, links] of Object.entries(words)) {
        expect(word).toMatch(/^[a-z]+$/)
        for (const targets of Object.values(links)) for (const t of targets) expect(t).toMatch(/^[a-z]+( [a-z]+)?$/)
      }
    }
  })

  it('rhyme and "starts like" with real words, never the word itself or a form of it', () => {
    const all: Words = Object.assign({}, ...files.map((f) => JSON.parse(f.text) as Words))
    expect(all.clock.rhymes).toEqual(expect.arrayContaining(['rock']))
    expect(all.clock.startsLike?.length).toBeGreaterThan(0)
    for (const [word, links] of Object.entries(all))
      for (const kind of ['rhymes', 'startsLike'])
        for (const other of links[kind] ?? []) {
          expect(other, `${kind} of ${word}`).not.toBe(word)
          expect(other.slice(0, 4), `${kind} of ${word}: ${other}`).not.toBe(word.slice(0, 4))
        }
  })

  it('leave out places, peoples, languages and religions entirely', () => {
    const all: Words = Object.assign({}, ...files.map((f) => JSON.parse(f.text) as Words))
    const used = new Set(Object.values(all).flatMap((links) => Object.values(links).flat()))
    const never = ['russia', 'france', 'china', 'japan', 'india', 'africa', 'america', 'europe', 'asia', 'mexico', 'canada', 'germany',
      'paris', 'london', 'tokyo', 'kabul', 'texas', 'scotland', 'islam', 'christianity', 'judaism', 'buddhism', 'hindi', 'latin',
      'russian', 'french', 'chinese', 'american', 'african', 'muslim', 'jewish', 'christian']
    for (const w of never) {
      expect(all[w], `${w} has nudges`).toBeUndefined()
      expect(used.has(w), `${w} comes out of a nudge`).toBe(false)
    }
    // Everyday words that are also places stay.
    expect(all.turkey && all.orange).toBeTruthy()
  })
})
