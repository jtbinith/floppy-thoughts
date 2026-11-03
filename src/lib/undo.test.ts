import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { UNDO_LIMIT, emptyUndo, pushChange, redo, undo } from './undo'

const b = (name: string): Board => ({
  version: 3,
  id: 'b',
  name,
  nodes: [],
  links: [],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
})

describe('undo and redo', () => {
  it('steps back and forward through changes', () => {
    let s = pushChange(emptyUndo(), b('one'))
    s = pushChange(s, b('two'))
    // current is 'three'
    const u1 = undo(s, b('three'))!
    expect(u1.board.name).toBe('two')
    const u2 = undo(u1.state, u1.board)!
    expect(u2.board.name).toBe('one')
    expect(undo(u2.state, u2.board)).toBeNull()
    const r1 = redo(u2.state, u2.board)!
    expect(r1.board.name).toBe('two')
    expect(redo(r1.state, r1.board)?.board.name).toBe('three')
  })

  it('clears redo after a new change', () => {
    const s = pushChange(emptyUndo(), b('one'))
    const u = undo(s, b('two'))!
    expect(pushChange(u.state, u.board).future).toEqual([])
  })

  it('keeps a limited number of steps', () => {
    let s = emptyUndo()
    for (let i = 0; i < UNDO_LIMIT + 10; i++) s = pushChange(s, b(String(i)))
    expect(s.past).toHaveLength(UNDO_LIMIT)
    expect(s.past[0].name).toBe('10')
  })
})
