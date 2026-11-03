import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { toFlowEdges, toFlowNodes, withPositions } from './flow'

const board: Board = {
  version: 4,
  id: 'b1',
  name: 'test',
  nodes: [
    { id: 'n1', number: 1, text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 },
    { id: 'n2', number: 2, text: 'plants', kind: 'user', x: 100, y: 50 },
  ],
  links: [{ from: 'n2', to: 'n1' }],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

describe('flow conversion', () => {
  it('turns board nodes into React Flow nodes', () => {
    expect(toFlowNodes(board)[1]).toEqual({
      id: 'n2',
      type: 'idea',
      position: { x: 100, y: 50 },
      data: { number: 2, text: 'plants', kind: 'user', category: undefined, locked: undefined, nudgeType: undefined },
    })
  })

  it('turns links into edges with a stable id whichever way round they are', () => {
    expect(toFlowEdges(board)).toEqual([{ id: 'n1--n2', source: 'n2', target: 'n1', type: 'centre' }])
  })

  it('copies dragged positions back onto the board, rounded', () => {
    const nodes = toFlowNodes(board)
    nodes[0].position = { x: 12.6, y: -40.2 }
    const updated = withPositions(board, nodes, new Date('2026-10-28T11:00:00Z'))
    expect(updated.nodes[0]).toMatchObject({ x: 13, y: -40 })
    expect(updated.nodes[1]).toEqual(board.nodes[1])
    expect(updated.updatedAt).toBe('2026-10-28T11:00:00.000Z')
  })
})
