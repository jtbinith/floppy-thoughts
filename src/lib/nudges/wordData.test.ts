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
  it('are one small file per letter', () => {
    expect(files.length).toBe(26)
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
})
