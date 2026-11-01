import type { Edge, Node } from '@xyflow/react'
import type { Board, BoardNode, Link } from './board'
import { moveNodes } from './boardOps'

// Converts between our saved Board and the shapes React Flow draws.
// Kept separate from the components so it can be unit tested.

// How "fit the board to the screen" frames things: the same for the button, the `fit` command,
// the View menu and when a board first opens.
export const FIT_VIEW = { padding: 0.3, maxZoom: 1.2, duration: 300 }

export type IdeaNodeData = Pick<BoardNode, 'text' | 'kind' | 'category' | 'locked' | 'nudgeType' | 'favourite' | 'chosen'>
export type IdeaFlowNode = Node<IdeaNodeData, 'idea'>

export function toFlowNodes(board: Board): IdeaFlowNode[] {
  return board.nodes.map(({ id, x, y, text, kind, category, locked, nudgeType, favourite, chosen }) => ({
    id,
    type: 'idea',
    position: { x, y },
    data: { text, kind, category, locked, nudgeType, favourite, chosen },
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
