import { describe, expect, it } from 'vitest'
import { parseBoard } from '../board'
import { swapSpark } from '../boardOps'
import { SPARKS } from './content'
import { dealSparks, swapFor } from './deal'
import { createBoard } from './newBoard'

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

  it('makes a valid blank board with three sparks', () => {
    const board = createBoard({ sparks, now: new Date('2026-10-28T12:00:00Z'), id: 'b1' })
    expect(parseBoard(board).ok).toBe(true)
    expect(board).toMatchObject({ mode: 'blank', name: 'untitled board', swapsLeft: 3 })
    expect(board.nodes.map((n) => n.text)).toEqual(['cassette', 'Pocket sundial', 'The dawn chorus'])
  })

  it('makes a theme board with the theme locked as the first spark', () => {
    const board = createBoard({ sparks: sparks.slice(0, 2), theme: '  Time ', id: 'b2' })
    expect(parseBoard(board).ok).toBe(true)
    expect(board).toMatchObject({ mode: 'theme', name: 'Time' })
    expect(board.nodes[0]).toMatchObject({ text: 'Time', category: 'theme', locked: true })
    expect(board.nodes).toHaveLength(3)
  })
})

describe('swapping sparks', () => {
  const board = createBoard({
    sparks: [
      { text: 'cassette', category: 'words' },
      { text: 'Pocket sundial', category: 'objects' },
    ],
    theme: 'Time',
    id: 'b3',
  })

  it('replaces a disk with another from the same category, using a swap', () => {
    const others = board.nodes.filter((n) => n.id !== 'n2').map((n) => ({ text: n.text, category: n.category! }))
    const next = swapFor({ text: 'cassette', category: 'words' }, others, { random: seeded(7) })
    expect(next.category).toBe('words')
    expect(next.text).not.toBe('cassette')
    const r = swapSpark(board, 'n2', next)
    if (!r.ok) throw new Error(r.error)
    expect(r.board.swapsLeft).toBe(2)
    expect(r.board.nodes[1]).toMatchObject({ id: 'n2', text: next.text, category: 'words' })
    expect(parseBoard(r.board).ok).toBe(true)
  })

  it('never swaps in a disk already on the board', () => {
    for (let seed = 1; seed < 30; seed++) {
      const next = swapFor({ text: 'cassette', category: 'words' }, [{ text: 'kettle', category: 'words' }], { random: seeded(seed) })
      expect(['cassette', 'kettle']).not.toContain(next.text)
    }
  })

  it('never swaps the theme, ideas, or with no swaps left', () => {
    const spark = { text: 'The dawn chorus', category: 'nature' as const }
    expect(swapSpark(board, 'n1', spark)).toEqual({ ok: false, error: 'n1 is the theme: it stays locked' })
    expect(swapSpark({ ...board, swapsLeft: 0 }, 'n2', spark).ok).toBe(false)
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
