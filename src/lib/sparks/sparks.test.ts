import { describe, expect, it } from 'vitest'
import { parseBoard } from '../board'
import { SPARKS } from './content'
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
