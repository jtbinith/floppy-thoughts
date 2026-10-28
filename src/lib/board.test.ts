import { describe, expect, it } from 'vitest'
import { MAX_NODE_TEXT, parseBoard, type Board } from './board'

function validBoard(): Board {
  return {
    version: 1,
    id: 'b1',
    name: 'time',
    mode: 'theme',
    swapsLeft: 3,
    nodes: [
      { id: 'n1', text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
      { id: 'n2', text: 'cassette', kind: 'spark', category: 'words', x: 180, y: 40 },
      { id: 'n3', text: 'how does a dog see this?', kind: 'nudge', nudgeType: 'perspective', x: 220, y: 160 },
      { id: 'n4', text: 'plants', kind: 'user', x: -60, y: 150 },
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

  it('accepts a blank board with no theme spark', () => {
    const board = validBoard()
    board.mode = 'blank'
    board.nodes = board.nodes.filter((n) => n.category !== 'theme')
    board.links = [{ from: 'n2', to: 'n3' }]
    expect(parseBoard(board).ok).toBe(true)
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

  it('rejects more swaps than the budget, or negative swaps', () => {
    expect(parseBoard({ ...validBoard(), swapsLeft: 4 }).ok).toBe(false)
    expect(parseBoard({ ...validBoard(), swapsLeft: -1 }).ok).toBe(false)
  })

  it('rejects a theme board without exactly one locked theme spark', () => {
    const unlocked = validBoard()
    unlocked.nodes[0].locked = false
    expect(errorsFor(unlocked)).toContain('nodes: Theme boards need exactly one locked theme spark')

    const missing = validBoard()
    missing.nodes[0].category = 'words'
    expect(parseBoard(missing).ok).toBe(false)
  })

  it('rejects a theme spark on a blank board', () => {
    expect(errorsFor({ ...validBoard(), mode: 'blank' })).toContain('nodes: Blank boards have no theme spark')
  })

  it('rejects more than 3 sparks', () => {
    const board = validBoard()
    board.nodes.push(
      { id: 'n5', text: 'banana', kind: 'spark', category: 'words', x: 0, y: 0 },
      { id: 'n6', text: 'mammoth', kind: 'spark', category: 'words', x: 0, y: 0 },
    )
    expect(errorsFor(board)).toContain('nodes: A board has at most 3 sparks')
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
