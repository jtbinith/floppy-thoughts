import { describe, expect, it } from 'vitest'
import { MAX_HISTORY, parseBoard, type Board } from './board'
import { addLink, addLinkedIdea, addUserNode, deleteUserNode, editUserNode, moveNodes, record, removeLink } from './boardOps'

const now = new Date('2026-10-28T12:00:00Z')
const t = now.toISOString()

const base: Board = {
  version: 1,
  id: 'b1',
  name: 'test',
  mode: 'blank',
  swapsLeft: 3,
  nodes: [{ id: 'n1', text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 }],
  links: [],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

function ok<T extends { ok: boolean }>(r: T) {
  if (!r.ok) throw new Error('expected ok')
  return r as Extract<T, { ok: true }>
}

describe('change history', () => {
  it('records every kind of change, in order, and stays a valid board', () => {
    let b = ok(addUserNode(base, 'radio', { x: 10, y: 20 }, now)).board
    b = ok(editUserNode(b, 'n2', 'dog radio', now)).board
    b = ok(addLink(b, 'n1', 'n2', now)).board
    b = moveNodes(b, [{ id: 'n2', x: 50.4, y: 60 }], now)
    b = ok(removeLink(b, 'n2', 'n1', now)).board
    b = ok(deleteUserNode(b, 'n2', now)).board

    expect(b.history).toEqual([
      { type: 'add', t, id: 'n2', text: 'radio', x: 10, y: 20 },
      { type: 'edit', t, id: 'n2', text: 'dog radio' },
      { type: 'link', t, from: 'n1', to: 'n2' },
      { type: 'move', t, id: 'n2', x: 50, y: 60 },
      { type: 'unlink', t, from: 'n2', to: 'n1' },
      { type: 'delete', t, id: 'n2' },
    ])
    expect(parseBoard(b).ok).toBe(true)
  })

  it('does not record moves for nodes that stayed put', () => {
    expect(moveNodes(base, [{ id: 'n1', x: 0.2, y: -0.3 }], now)).toBe(base)
  })

  it('keeps only the most recent changes', () => {
    const many = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({ type: 'delete' as const, id: `x${i}` }))
    const b = record(base, many, now)
    expect(b.history).toHaveLength(MAX_HISTORY)
    expect(b.history?.at(-1)).toMatchObject({ id: `x${MAX_HISTORY + 4}` })
  })

  it('still loads boards saved before history existed', () => {
    expect(parseBoard(base).ok).toBe(true)
  })
})

describe('addLinkedIdea', () => {
  it('adds an idea already linked to the node it came from', () => {
    const r = ok(addLinkedIdea(base, 'n1', 'mixtape', { x: 0, y: 150 }, now))
    expect(r.node).toMatchObject({ id: 'n2', text: 'mixtape' })
    expect(r.board.links).toEqual([{ from: 'n1', to: 'n2' }])
  })

  it('fails cleanly for an unknown node', () => {
    expect(addLinkedIdea(base, 'n9', 'x', { x: 0, y: 0 })).toEqual({ ok: false, error: 'No node called n9' })
  })
})
