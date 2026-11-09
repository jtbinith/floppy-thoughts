import { describe, expect, it } from 'vitest'
import { parseBoard } from '../board'
import { NOTES, SPARKS } from './content'
import declined from '../../content/notes/declined.json'
import { QUESTIONS, fillQuestion } from '../nudges/questions'
import { createBoard } from './newBoard'
import { rowEmpty, vendNote } from './vend'

describe('createBoard', () => {
  const sparks = [
    { text: 'cassette', category: 'words' as const },
    { text: 'Pocket sundial', category: 'objects' as const },
    { text: 'The dawn chorus', category: 'nature' as const },
  ]

  it('makes a valid board with the starting notes', () => {
    const board = createBoard({ sparks, now: new Date('2026-10-28T12:00:00Z'), id: 'b1' })
    expect(parseBoard(board).ok).toBe(true)
    expect(board.name).toBe('untitled board')
    expect(board.nodes.map((n) => n.text)).toEqual(['cassette', 'Pocket sundial', 'The dawn chorus'])
  })

  it('makes an empty board, or one with lots of notes spread out', () => {
    expect(createBoard({ sparks: [], id: 'b0' }).nodes).toEqual([])
    const many = createBoard({ sparks: SPARKS.words.slice(0, 9).map((text) => ({ text, category: 'words' as const })), id: 'b9' })
    expect(parseBoard(many).ok).toBe(true)
    expect(new Set(many.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(9)
  })
})

describe('content', () => {
  it('has enough sparks in every category, all short enough and unique', () => {
    for (const [category, items] of Object.entries(SPARKS)) {
      expect(items.length, category).toBeGreaterThanOrEqual(25)
      expect(new Set(items).size, category).toBe(items.length)
      for (const text of items) expect(text.length, text).toBeLessThanOrEqual(80)
    }
  })

  it('never repeats a note across rows', () => {
    const all = Object.values(SPARKS).flat().map((t) => t.toLowerCase())
    const seen = new Set<string>()
    const repeats = all.filter((t) => (seen.has(t) ? true : (seen.add(t), false)))
    expect(repeats).toEqual([])
  })

  it('writes problems as a quote, in the first person', () => {
    for (const p of SPARKS.problems) expect(p, p).toMatch(/^".+"$/)
  })

  it('keeps notes plain: no full stop at the end and no serial comma', () => {
    for (const text of Object.values(SPARKS).flat()) {
      expect(text, text).not.toMatch(/\.$/)
      expect(text, text).not.toMatch(/, (and|or) /)
    }
  })
})

describe('note files', () => {
  it('says where every note came from, with a source for every fact', () => {
    for (const [row, notes] of Object.entries(NOTES))
      for (const n of notes) {
        expect(['hand', 'met', 'wordnet', 'wikidata'], `${row}: ${n.text}`).toContain(n.origin)
        if (n.source !== undefined) expect(n.source, n.text).toMatch(/^https:\/\//)
      }
    for (const n of NOTES.curiosities) expect(n.source, n.text).toBeDefined()
  })

  it('never brings back a note that was declined', () => {
    const out = new Set((declined as { text: string }[]).map((d) => d.text.toLowerCase()))
    expect(Object.values(SPARKS).flat().filter((t) => out.has(t.toLowerCase()))).toEqual([])
  })
})

describe('nudge questions', () => {
  it('has plenty of each kind, all unique', () => {
    for (const [kind, items] of Object.entries(QUESTIONS)) {
      expect(items.length, kind).toBeGreaterThanOrEqual(25)
      expect(new Set(items).size, kind).toBe(items.length)
    }
  })

  it('asks a question (or gives a short push), and only perspective, scale and senses name the idea', () => {
    for (const kind of ['perspective', 'scale', 'senses'] as const) for (const q of QUESTIONS[kind]) expect(q, q).toMatch(/\{x\}.*\?$|\?$/)
    for (const q of QUESTIONS.push) expect(q, q).toMatch(/[.?]$/)
    for (const q of Object.values(QUESTIONS).flat()) expect(fillQuestion(q, 'a kite').length, q).toBeLessThanOrEqual(90)
  })
})

describe('vending', () => {
  it('vends from the chosen row, never a note already on the board', () => {
    const onBoard = new Set(SPARKS.words.slice(1))
    expect(vendNote('words', onBoard)).toEqual({ text: SPARKS.words[0], category: 'words' })
    expect(vendNote('surprise', new Set())?.category).toBeDefined()
  })

  it('runs a row out only when its whole category is on the board', () => {
    const all = new Set(SPARKS.words)
    expect(rowEmpty('words', all)).toBe(true)
    expect(vendNote('words', all)).toBeNull()
    expect(rowEmpty('surprise', all)).toBe(false)
    expect(vendNote('surprise', all)?.category).not.toBe('words')
  })
})
