import { MAX_NODE_TEXT, type Board, type BoardNode } from './board'

// Pure board edits. Each returns a new board; nothing is mutated.
// Only the user's own nodes can be edited or deleted: sparks are swapped (Batch 2), nudges come in Batch 3.

export type OpResult = { ok: true; board: Board; node?: BoardNode } | { ok: false; error: string }

const touch = (board: Board, now: Date): Board => ({ ...board, updatedAt: now.toISOString() })

export function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, MAX_NODE_TEXT)
}

// Short, readable ids (n1, n2…) so they can be typed in the terminal.
export function nextNodeId(board: Board): string {
  const max = board.nodes.reduce((m, n) => {
    const match = /^n(\d+)$/.exec(n.id)
    return match ? Math.max(m, Number(match[1])) : m
  }, 0)
  return `n${max + 1}`
}

export function findNode(board: Board, id: string): BoardNode | undefined {
  return board.nodes.find((n) => n.id === id)
}

export function addUserNode(board: Board, text: string, at: { x: number; y: number }, now = new Date()): OpResult {
  const clean = cleanText(text)
  if (!clean) return { ok: false, error: 'An idea needs some text' }
  const node: BoardNode = { id: nextNodeId(board), text: clean, kind: 'user', x: Math.round(at.x), y: Math.round(at.y) }
  return { ok: true, board: touch({ ...board, nodes: [...board.nodes, node] }, now), node }
}

export function editUserNode(board: Board, id: string, text: string, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `No node called ${id}` }
  if (node.kind !== 'user') return { ok: false, error: `${id} is a ${node.kind}: only your own ideas can be edited` }
  const clean = cleanText(text)
  if (!clean) return { ok: false, error: 'An idea needs some text' }
  const edited = { ...node, text: clean }
  return {
    ok: true,
    board: touch({ ...board, nodes: board.nodes.map((n) => (n.id === id ? edited : n)) }, now),
    node: edited,
  }
}

export function deleteUserNode(board: Board, id: string, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `No node called ${id}` }
  if (node.kind !== 'user') return { ok: false, error: `${id} is a ${node.kind}: only your own ideas can be deleted` }
  return {
    ok: true,
    board: touch(
      {
        ...board,
        nodes: board.nodes.filter((n) => n.id !== id),
        // Links to a deleted node go with it.
        links: board.links.filter((l) => l.from !== id && l.to !== id),
      },
      now,
    ),
    node,
  }
}

const sameLink = (a: string, b: string) => (l: { from: string; to: string }) =>
  (l.from === a && l.to === b) || (l.from === b && l.to === a)

// Any two nodes can be linked, whatever their kind. Links are undirected.
export function addLink(board: Board, a: string, b: string, now = new Date()): OpResult {
  if (a === b) return { ok: false, error: 'A node cannot link to itself' }
  for (const id of [a, b]) if (!findNode(board, id)) return { ok: false, error: `No node called ${id}` }
  if (board.links.some(sameLink(a, b))) return { ok: false, error: `${a} and ${b} are already linked` }
  return { ok: true, board: touch({ ...board, links: [...board.links, { from: a, to: b }] }, now) }
}

export function removeLink(board: Board, a: string, b: string, now = new Date()): OpResult {
  if (!board.links.some(sameLink(a, b))) return { ok: false, error: `${a} and ${b} aren't linked` }
  return { ok: true, board: touch({ ...board, links: board.links.filter((l) => !sameLink(a, b)(l)) }, now) }
}
