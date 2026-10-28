import type { Edge, Node } from '@xyflow/react'
import type { Board, BoardNode, Link } from './board'
import { moveNodes } from './boardOps'

// Converts between our saved Board and the shapes React Flow draws.
// Kept separate from the components so it can be unit tested.

export type IdeaNodeData = Pick<BoardNode, 'text' | 'kind' | 'category' | 'locked' | 'nudgeType'>
export type IdeaFlowNode = Node<IdeaNodeData, 'idea'>

export function toFlowNodes(board: Board): IdeaFlowNode[] {
  return board.nodes.map(({ id, x, y, text, kind, category, locked, nudgeType }) => ({
    id,
    type: 'idea',
    position: { x, y },
    data: { text, kind, category, locked, nudgeType },
  }))
}

export function linkId(link: Link): string {
  return [link.from, link.to].sort().join('--')
}

export function toFlowEdges(board: Board): Edge[] {
  return board.links.map((link) => ({
    id: linkId(link),
    source: link.from,
    target: link.to,
    type: 'centre',
  }))
}

// Copies positions from React Flow back onto the board, e.g. after a drag.
export function withPositions(board: Board, nodes: IdeaFlowNode[], now = new Date()): Board {
  return moveNodes(
    board,
    nodes.map((n) => ({ id: n.id, ...n.position })),
    now,
  )
}
