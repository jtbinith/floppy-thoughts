import { BOARD_CAPACITY, MAX_NODE_TEXT, type Board, type BoardNode, type NudgeType, type SparkCategory } from './board'

// Pure board edits. Each returns a new board; nothing is mutated.
// Only your own ideas can be edited. Ideas and nudges can be deleted; sparks are swapped instead (Batch 2).

export type OpResult = { ok: true; board: Board; node?: BoardNode } | { ok: false; error: string }

// Marks the board as just updated.
export function touch(board: Board, now: Date): Board {
  return { ...board, updatedAt: now.toISOString() }
}

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

export const BOARD_FULL_MESSAGE = `The board is full (${BOARD_CAPACITY} ideas). Time to pick a direction, or delete something to make room.`

export function spaceLeft(board: Board): number {
  return Math.max(0, BOARD_CAPACITY - board.nodes.length)
}

export function addUserNode(board: Board, text: string, at: { x: number; y: number }, now = new Date()): OpResult {
  if (spaceLeft(board) === 0) return { ok: false, error: BOARD_FULL_MESSAGE }
  const clean = cleanText(text)
  if (!clean) return { ok: false, error: 'An idea needs some text' }
  const node: BoardNode = { id: nextNodeId(board), text: clean, kind: 'user', x: Math.round(at.x), y: Math.round(at.y) }
  return {
    ok: true,
    board: touch({ ...board, nodes: [...board.nodes, node] }, now),
    node,
  }
}

export function editUserNode(board: Board, id: string, text: string, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `No node called ${id}` }
  if (node.kind !== 'user') return { ok: false, error: `${id} is a ${node.kind === 'spark' ? 'disk' : node.kind}: only your own ideas can be edited` }
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
  if (node.kind === 'spark') return { ok: false, error: `${id} is a disk: disks can be swapped, not deleted` }
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
  return {
    ok: true,
    board: touch({ ...board, links: board.links.filter((l) => !sameLink(a, b)(l)) }, now),
  }
}

// Moves nodes, e.g. after a drag. Returns the same board if nothing actually moved.
export function moveNodes(board: Board, positions: { id: string; x: number; y: number }[], now = new Date()): Board {
  let moved = false
  const nodes = board.nodes.map((node) => {
    const p = positions.find((q) => q.id === node.id)
    if (!p) return node
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    if (x === node.x && y === node.y) return node
    moved = true
    return { ...node, x, y }
  })
  return moved ? touch({ ...board, nodes }, now) : board
}

// Adds a new idea already linked to an existing node: the fast way to build a chain.
export function addLinkedIdea(board: Board, fromId: string, text: string, at: { x: number; y: number }, now = new Date()): OpResult {
  if (!findNode(board, fromId)) return { ok: false, error: `No node called ${fromId}` }
  const added = addUserNode(board, text, at, now)
  if (!added.ok || !added.node) return added
  const linked = addLink(added.board, fromId, added.node.id, now)
  return linked.ok ? { ...linked, node: added.node } : linked
}

// Adds a nudge (a word or question) linked to the node it's about.
export function addNudge(
  board: Board,
  targetId: string,
  nudge: { text: string; type: NudgeType },
  at: { x: number; y: number },
  now = new Date(),
): OpResult {
  if (!findNode(board, targetId)) return { ok: false, error: `No node called ${targetId}` }
  if (spaceLeft(board) === 0) return { ok: false, error: BOARD_FULL_MESSAGE }
  const text = cleanText(nudge.text)
  if (!text) return { ok: false, error: 'A nudge needs some text' }
  const node: BoardNode = { id: nextNodeId(board), text, kind: 'nudge', nudgeType: nudge.type, x: Math.round(at.x), y: Math.round(at.y) }
  const added = touch({ ...board, nodes: [...board.nodes, node] }, now)
  const linked = addLink(added, targetId, node.id, now)
  return linked.ok ? { ...linked, node } : linked
}

export const NO_SWAPS_MESSAGE = 'No swaps left on this board. Work with what you have: that is where the interesting ideas are.'

// Replaces a spark with a new one, using up a swap. Its links stay, so your thinking around it isn't lost.
export function swapSpark(board: Board, id: string, spark: { text: string; category: SparkCategory }, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `No node called ${id}` }
  if (node.kind !== 'spark') return { ok: false, error: `${id} isn't a disk: only disks can be swapped` }
  if (node.locked) return { ok: false, error: `${id} is the theme: it stays locked` }
  if (board.swapsLeft <= 0) return { ok: false, error: NO_SWAPS_MESSAGE }
  const swapped: BoardNode = { ...node, text: spark.text, category: spark.category }
  return {
    ok: true,
    board: touch({ ...board, swapsLeft: board.swapsLeft - 1, nodes: board.nodes.map((n) => (n.id === id ? swapped : n)) }, now),
    node: swapped,
  }
}
