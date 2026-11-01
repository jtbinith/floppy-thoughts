import { describe, expect, it } from 'vitest'
import { parseBoard, type Board } from './board'
import { addLinkedIdea, moveNodes } from './boardOps'

const now = new Date('2026-10-28T12:00:00Z')

const base: Board = {
  version: 2,
  id: 'b1',
  name: 'test',
  nodes: [{ id: 'n1', text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 }],
  links: [],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

describe('moveNodes', () => {
  it('moves nodes to rounded positions and stamps the board', () => {
    const b = moveNodes(base, [{ id: 'n1', x: 50.4, y: 60 }], now)
    expect(b.nodes[0]).toMatchObject({ x: 50, y: 60 })
    expect(b.updatedAt).toBe(now.toISOString())
  })

  it('returns the same board when nothing really moved', () => {
    expect(moveNodes(base, [{ id: 'n1', x: 0.2, y: -0.3 }], now)).toBe(base)
  })
})

describe('older saved boards', () => {
  it('still load if they have the old replay history, which is simply dropped', () => {
    const result = parseBoard({ ...base, history: [{ type: 'add', t: now.toISOString(), id: 'n1' }] })
    expect(result.ok).toBe(true)
    expect(result.ok && 'history' in result.board).toBe(false)
  })
})

describe('addLinkedIdea', () => {
  it('adds an idea already linked to the node it came from', () => {
    const r = addLinkedIdea(base, 'n1', 'mixtape', { x: 0, y: 150 }, now)
    if (!r.ok) throw new Error(r.error)
    expect(r.node).toMatchObject({ id: 'n2', text: 'mixtape' })
    expect(r.board.links).toEqual([{ from: 'n1', to: 'n2' }])
  })

  it('fails cleanly for an unknown node', () => {
    expect(addLinkedIdea(base, 'n9', 'x', { x: 0, y: 0 })).toEqual({ ok: false, error: 'Nothing numbered 9' })
  })
})
