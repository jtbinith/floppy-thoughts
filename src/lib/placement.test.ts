import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { BOX, freeSpotNear } from './placement'

const empty: Board = {
  version: 3,
  id: 'b',
  name: 'b',
  nodes: [],
  links: [],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

describe('freeSpotNear', () => {
  it('centres the node on the target when the space is free', () => {
    expect(freeSpotNear(empty, { x: BOX.width / 2, y: BOX.height / 2 })).toEqual({ x: 0, y: 0 })
  })

  it('never puts many new nodes on top of each other', () => {
    let board = empty
    for (let i = 0; i < 20; i++) {
      const spot = freeSpotNear(board, { x: 0, y: 0 })
      board = { ...board, nodes: [...board.nodes, { id: `n${i}`, number: i + 1, text: 'x', kind: 'user', ...spot }] }
    }
    const spots = new Set(board.nodes.map((n) => `${n.x},${n.y}`))
    expect(spots.size).toBe(20)
    for (const a of board.nodes)
      for (const b of board.nodes)
        if (a !== b) expect(Math.abs(a.x - b.x) >= 230 || Math.abs(a.y - b.y) >= 90).toBe(true)
  })
})

describe('placing within the visible board', () => {
  // The middle of the view is taken, so the spot has to go somewhere else on screen.
  const board: Board = { ...empty, nodes: [{ id: 'n1', number: 1, text: 'x', kind: 'user', x: -115, y: -45 }] }

  it('prefers a free spot that is on screen', () => {
    const view = { x: -400, y: -300, width: 800, height: 600 }
    const spot = freeSpotNear(board, { x: 0, y: 0 }, view)
    expect(spot).not.toEqual({ x: -115, y: -45 })
    expect(spot.x).toBeGreaterThanOrEqual(view.x)
    expect(spot.y).toBeGreaterThanOrEqual(view.y)
    expect(spot.x + 230).toBeLessThanOrEqual(view.x + view.width)
    expect(spot.y + 90).toBeLessThanOrEqual(view.y + view.height)
  })

  it('looks further out when the visible area is full', () => {
    const tiny = { x: 0, y: 0, width: 10, height: 10 }
    expect(freeSpotNear(board, { x: 0, y: 0 }, tiny)).toBeDefined()
  })
})
