import { describe, expect, it } from 'vitest'
import { parseBoard } from '../board'
import { swapSpark } from '../boardOps'
import { SPARKS } from './content'
import { dealSparks, swapFor } from './deal'
import { createBoard } from './newBoard'
import { rowEmpty, vendNote } from './vend'

// A repeatable "random" sequence so tests are stable.
function seeded(seed = 1) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

describe('dealSparks', () => {
  it('deals sparks from different categories', () => {
    for (let seed = 1; seed < 50; seed++) {
      const sparks = dealSparks(3, { random: seeded(seed) })
      expect(new Set(sparks.map((s) => s.category)).size).toBe(3)
    }
  })

  it('prefers sparks you have not seen', () => {
    const seen = new Set(SPARKS.words.slice(1))
    for (let seed = 1; seed < 20; seed++) {
      const words = dealSparks(5, { seen, random: seeded(seed) }).find((s) => s.category === 'words')
      expect(words?.text).toBe(SPARKS.words[0])
    }
  })

  it('deals more notes than there are categories without repeating text', () => {
    for (let seed = 1; seed < 20; seed++) {
      const sparks = dealSparks(9, { random: seeded(seed) })
      expect(sparks).toHaveLength(9)
      expect(new Set(sparks.map((s) => s.text)).size).toBe(9)
      // Every category is used before any repeats.
      expect(new Set(sparks.slice(0, 5).map((s) => s.category)).size).toBe(5)
    }
    expect(dealSparks(0)).toEqual([])
  })

  it('can avoid categories', () => {
    const sparks = dealSparks(2, { avoid: ['words', 'problems', 'objects'], random: seeded(3) })
    expect(sparks.every((s) => !['words', 'problems', 'objects'].includes(s.category))).toBe(true)
  })
})

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
    const many = createBoard({ sparks: dealSparks(9, { random: seeded(2) }), id: 'b9' })
    expect(parseBoard(many).ok).toBe(true)
    expect(new Set(many.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(9)
  })
})

describe('swapping sparks', () => {
  const board = createBoard({
    sparks: [
      { text: 'Time', category: 'theme' },
      { text: 'cassette', category: 'words' },
      { text: 'Pocket sundial', category: 'objects' },
    ],
    id: 'b3',
  })

  it('replaces a note with another from the same category, as often as you like', () => {
    const others = board.nodes.filter((n) => n.id !== 'n2').map((n) => ({ text: n.text, category: n.category! }))
    const next = swapFor({ text: 'cassette', category: 'words' }, others, { random: seeded(7) })
    expect(next.category).toBe('words')
    expect(next.text).not.toBe('cassette')
    const r = swapSpark(board, 'n2', next)
    if (!r.ok) throw new Error(r.error)
    expect(r.board.nodes[1]).toMatchObject({ id: 'n2', text: next.text, category: 'words' })
    expect(parseBoard(r.board).ok).toBe(true)
  })

  it('never swaps in a note already on the board', () => {
    for (let seed = 1; seed < 30; seed++) {
      const next = swapFor({ text: 'cassette', category: 'words' }, [{ text: 'kettle', category: 'words' }], { random: seeded(seed) })
      expect(['cassette', 'kettle']).not.toContain(next.text)
    }
  })

  it('never swaps a theme or a missing node', () => {
    const spark = { text: 'The dawn chorus', category: 'nature' as const }
    expect(swapSpark(board, 'n1', spark)).toEqual({ ok: false, error: 'n1 is a theme: it stays as you wrote it' })
    expect(swapSpark(board, 'n9', spark).ok).toBe(false)
  })

  it('never offers the same text back', () => {
    for (let seed = 1; seed < 30; seed++) {
      const next = swapFor({ text: 'cassette', category: 'words' }, [], { random: seeded(seed) })
      expect(next.text).not.toBe('cassette')
    }
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
