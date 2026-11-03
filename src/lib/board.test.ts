import { describe, expect, it } from 'vitest'
import { MAX_NODE_TEXT, idOf, numberOf, parseBoard, type Board } from './board'

function validBoard(): Board {
  return {
    version: 3,
    id: 'b1',
    name: 'time',
    nodes: [
      { id: 'n1', number: 1, text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
      { id: 'n2', number: 2, text: 'cassette', kind: 'spark', category: 'words', x: 180, y: 40 },
      { id: 'n3', number: 3, text: 'how does a dog see this?', kind: 'nudge', nudgeType: 'perspective', x: 220, y: 160 },
      { id: 'n4', number: 4, text: 'plants', kind: 'user', x: -60, y: 150 },
    ],
    links: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
    ],
    createdAt: '2026-10-27T10:00:00Z',
    updatedAt: '2026-10-27T10:12:00Z',
  }
}

function errorsFor(data: unknown): string[] {
  const result = parseBoard(data)
  return result.ok ? [] : result.errors
}

describe('parseBoard', () => {
  it('accepts a valid board', () => {
    expect(parseBoard(validBoard())).toEqual({ ok: true, board: validBoard() })
  })

  it('accepts any number of notes and themes, and favourites on any node', () => {
    const board = validBoard()
    for (let i = 5; i < 15; i++) board.nodes.push({ id: `n${i}`, number: i, text: `note ${i}`, kind: 'spark', category: i % 2 ? 'theme' : 'words', x: 0, y: 0 })
    board.nodes[2].favourite = true
    expect(parseBoard(board).ok).toBe(true)
  })

  it('upgrades version 1 boards, dropping swaps and mode', () => {
    const { version: _, ...rest } = validBoard()
    const result = parseBoard({ ...rest, version: 1, mode: 'theme', swapsLeft: 2 })
    expect(result).toEqual({ ok: true, board: validBoard() })
  })

  it('rejects things that are not boards', () => {
    expect(parseBoard(null).ok).toBe(false)
    expect(parseBoard('{"hacked": true}').ok).toBe(false)
    expect(parseBoard([]).ok).toBe(false)
  })

  it('rejects a missing or unknown version', () => {
    const { version: _, ...noVersion } = validBoard()
    expect(parseBoard(noVersion).ok).toBe(false)
    expect(parseBoard({ ...validBoard(), version: 99 }).ok).toBe(false)
  })

  it('rejects an unknown node kind', () => {
    const board = validBoard()
    ;(board.nodes[3] as { kind: string }).kind = 'alien'
    expect(errorsFor(board).some((e) => e.startsWith('nodes.3.kind'))).toBe(true)
  })

  it('rejects empty or too-long node text', () => {
    const empty = validBoard()
    empty.nodes[3].text = '   '
    expect(parseBoard(empty).ok).toBe(false)

    const long = validBoard()
    long.nodes[3].text = 'a'.repeat(MAX_NODE_TEXT + 1)
    expect(parseBoard(long).ok).toBe(false)
  })

  it('rejects duplicate node ids', () => {
    const board = validBoard()
    board.nodes[3].id = 'n2'
    expect(errorsFor(board)).toContain('nodes.3.id: Duplicate node id "n2"')
  })

  it('rejects links to nodes that do not exist', () => {
    const board = validBoard()
    board.links.push({ from: 'n1', to: 'ghost' })
    expect(errorsFor(board)).toContain('links.2.to: Link to unknown node "ghost"')
  })

  it('rejects self-links and duplicate links in either direction', () => {
    const self = validBoard()
    self.links.push({ from: 'n4', to: 'n4' })
    expect(errorsFor(self)).toContain('links.2: A node cannot link to itself')

    const dupe = validBoard()
    dupe.links.push({ from: 'n2', to: 'n1' })
    expect(errorsFor(dupe)).toContain('links.2: Duplicate link')
  })

  it('rejects fields on the wrong kind of node', () => {
    const board = validBoard()
    board.nodes[3].nudgeType = 'scale'
    board.nodes[3].locked = true
    const errors = errorsFor(board)
    expect(errors).toContain('nodes.3.nudgeType: Only nudges have a nudgeType')
    expect(errors).toContain('nodes.3.locked: Only sparks can be locked')
  })

  it('requires nudges to have a type and sparks to have a category', () => {
    const board = validBoard()
    delete board.nodes[2].nudgeType
    delete board.nodes[1].category
    const errors = errorsFor(board)
    expect(errors).toContain('nodes.2.nudgeType: Nudges need a nudgeType')
    expect(errors).toContain('nodes.1.category: Sparks need a category')
  })

  it('rejects non-finite coordinates', () => {
    const board = validBoard()
    board.nodes[0].x = Number.POSITIVE_INFINITY
    expect(parseBoard(board).ok).toBe(false)
  })
})

describe('version 3: box numbers', () => {
  // A version 2 board: boxes numbered through their ids, plus one odd id from an import.
  const v2 = () => ({
    version: 2,
    id: 'b1',
    name: 'old board',
    nodes: [
      { id: 'n1', text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
      { id: 'n4', text: 'clocks', kind: 'user', x: 10, y: 10 },
      { id: 'imported', text: 'odd one', kind: 'user', x: 20, y: 20 },
    ],
    links: [{ from: 'n1', to: 'n4' }],
    createdAt: '2026-10-28T10:00:00Z',
    updatedAt: '2026-10-28T10:00:00Z',
  })

  it('upgrades version 2 boards: keeps ids and links, adds numbers from n1, n2…', () => {
    const result = parseBoard(v2())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.board.version).toBe(3)
    expect(result.board.nodes.map((n) => [n.id, n.number])).toEqual([
      ['n1', 1],
      ['n4', 4],
      // Ids that aren't n-numbers get the next free number.
      ['imported', 5],
    ])
    expect(result.board.links).toEqual([{ from: 'n1', to: 'n4' }])
  })

  it('refuses two boxes with the same number', () => {
    const board = validBoard()
    board.nodes[1].number = board.nodes[0].number
    expect(parseBoard(board).ok).toBe(false)
  })

  it('turns typed numbers into ids, and ids into numbers', () => {
    const result = parseBoard(v2())
    if (!result.ok) throw new Error('bad board')
    const board = result.board
    expect(idOf(board, '4')).toBe('n4')
    expect(idOf(board, 'n4')).toBe('n4')
    expect(idOf(board, '5')).toBe('imported')
    // Not on the board: left as typed, for a clear "nothing numbered 9".
    expect(idOf(board, '9')).toBe('9')
    expect(numberOf(board, 'imported')).toBe('5')
    expect(numberOf(board, '9')).toBe('9')
  })
})
