import { BOARD_CAPACITY, MAX_HISTORY, MAX_NODE_TEXT, type Board, type BoardNode, type HistoryEntry, type NudgeType, type SparkCategory } from './board'

// Pure board edits. Each returns a new board; nothing is mutated.
// Only your own ideas can be edited. Ideas and nudges can be deleted; sparks are swapped instead (Batch 2).

export type OpResult = { ok: true; board: Board; node?: BoardNode } | { ok: false; error: string }

// Spreading a Distributive Omit keeps each history entry type intact.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
export type Change = DistributiveOmit<HistoryEntry, 't'>

// Stamps the board as updated and records what changed, for replay.
export function record(board: Board, changes: Change[], now: Date): Board {
  const t = now.toISOString()
  const history = [...(board.history ?? []), ...changes.map((c) => ({ ...c, t }) as HistoryEntry)]
  return { ...board, updatedAt: t, history: history.slice(-MAX_HISTORY) }
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
  const { id, x, y } = node
  return {
    ok: true,
    board: record({ ...board, nodes: [...board.nodes, node] }, [{ type: 'add', id, text: clean, x, y }], now),
    node,
  }
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
    board: record({ ...board, nodes: board.nodes.map((n) => (n.id === id ? edited : n)) }, [{ type: 'edit', id, text: clean }], now),
    node: edited,
  }
}

export function deleteUserNode(board: Board, id: string, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `No node called ${id}` }
  if (node.kind === 'spark') return { ok: false, error: `${id} is a spark: sparks can be swapped, not deleted` }
  return {
    ok: true,
    board: record(
      {
        ...board,
        nodes: board.nodes.filter((n) => n.id !== id),
        // Links to a deleted node go with it.
        links: board.links.filter((l) => l.from !== id && l.to !== id),
      },
      [{ type: 'delete', id }],
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
  return { ok: true, board: record({ ...board, links: [...board.links, { from: a, to: b }] }, [{ type: 'link', from: a, to: b }], now) }
}

export function removeLink(board: Board, a: string, b: string, now = new Date()): OpResult {
  if (!board.links.some(sameLink(a, b))) return { ok: false, error: `${a} and ${b} aren't linked` }
  return {
    ok: true,
    board: record({ ...board, links: board.links.filter((l) => !sameLink(a, b)(l)) }, [{ type: 'unlink', from: a, to: b }], now),
  }
}

// Moves nodes, e.g. after a drag. Only nodes that actually moved are recorded.
export function moveNodes(board: Board, positions: { id: string; x: number; y: number }[], now = new Date()): Board {
  const changes: Change[] = []
  const nodes = board.nodes.map((node) => {
    const p = positions.find((q) => q.id === node.id)
    if (!p) return node
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    if (x === node.x && y === node.y) return node
    changes.push({ type: 'move', id: node.id, x, y })
    return { ...node, x, y }
  })
  return changes.length ? record({ ...board, nodes }, changes, now) : board
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
  const added = record({ ...board, nodes: [...board.nodes, node] }, [{ type: 'add', id: node.id, text, x: node.x, y: node.y }], now)
  const linked = addLink(added, targetId, node.id, now)
  return linked.ok ? { ...linked, node } : linked
}

export const NO_SWAPS_MESSAGE = 'No swaps left on this board. Work with what you have: that is where the interesting ideas are.'

// Replaces a spark with a new one, using up a swap. Its links stay, so your thinking around it isn't lost.
export function swapSpark(board: Board, id: string, spark: { text: string; category: SparkCategory }, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `No node called ${id}` }
  if (node.kind !== 'spark') return { ok: false, error: `${id} isn't a spark: only sparks can be swapped` }
  if (node.locked) return { ok: false, error: `${id} is the theme: it stays locked` }
  if (board.swapsLeft <= 0) return { ok: false, error: NO_SWAPS_MESSAGE }
  const swapped: BoardNode = { ...node, text: spark.text, category: spark.category }
  return {
    ok: true,
    board: record(
      { ...board, swapsLeft: board.swapsLeft - 1, nodes: board.nodes.map((n) => (n.id === id ? swapped : n)) },
      [{ type: 'swap', id, text: spark.text }],
      now,
    ),
    node: swapped,
  }
}
