import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { freeSpotNear } from './placement'

const empty: Board = {
  version: 2,
  id: 'b',
  name: 'b',
  nodes: [],
  links: [],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

describe('freeSpotNear', () => {
  it('centres the node on the target when the space is free', () => {
    expect(freeSpotNear(empty, { x: 115, y: 45 })).toEqual({ x: 0, y: 0 })
  })

  it('never puts many new nodes on top of each other', () => {
    let board = empty
    for (let i = 0; i < 20; i++) {
      const spot = freeSpotNear(board, { x: 0, y: 0 })
      board = { ...board, nodes: [...board.nodes, { id: `n${i}`, text: 'x', kind: 'user', ...spot }] }
    }
    const spots = new Set(board.nodes.map((n) => `${n.x},${n.y}`))
    expect(spots.size).toBe(20)
    for (const a of board.nodes)
      for (const b of board.nodes)
        if (a !== b) expect(Math.abs(a.x - b.x) >= 230 || Math.abs(a.y - b.y) >= 90).toBe(true)
  })
})
