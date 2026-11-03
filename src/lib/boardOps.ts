import { MAX_NODE_TEXT, MAX_NODES, ME, numberOf, type Board, type BoardNode, type NudgeType, type SparkCategory } from './board'

// Pure board edits. Each returns a new board; nothing is mutated.
// Only what you wrote can be edited: your ideas and your themes. Anything can be deleted or favourites.
// In the UI sparks are called notes: the shrimp notes from the vending machine.

const sameLink = (a: string, b: string) => (l: { from: string; to: string }) =>
  (l.from === a && l.to === b) || (l.from === b && l.to === a)

export type OpResult = { ok: true; board: Board; node?: BoardNode } | { ok: false; error: string }

// Marks the board as just updated.
export function touch(board: Board, now: Date): Board {
  return { ...board, updatedAt: now.toISOString() }
}

export function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, MAX_NODE_TEXT)
}

// A new box's id (random, so two people adding at once can't clash) and its number (the next one
// up, shown on the box and typed in commands).
export const newNodeId = () => crypto.randomUUID()
export function nextNumber(board: Board): number {
  return board.nodes.reduce((m, n) => Math.max(m, n.number), 0) + 1
}

export function findNode(board: Board, id: string): BoardNode | undefined {
  return board.nodes.find((n) => n.id === id)
}

export const isTheme = (node: BoardNode) => node.kind === 'spark' && node.category === 'theme'

// The board's themes (e.g. hackathon themes like "Time" and "Sustainability"). A board can have
// any number, or none.
export function themes(board: Board): BoardNode[] {
  return board.nodes.filter(isTheme)
}

// The first theme you added: what tidying keeps still.
export function mainTheme(board: Board): BoardNode | undefined {
  return board.nodes.find(isTheme)
}

// The nodes linked to `id`.
export function neighbours(board: Board, id: string): string[] {
  return board.links.filter((l) => l.from === id || l.to === id).map((l) => (l.from === id ? l.to : l.from))
}

// If `id` sits in the middle of a chain (linked to exactly two things), those two.
// Deleting it could keep the chain connected by linking them to each other.
export function chainAround(board: Board, id: string): [string, string] | null {
  const around = neighbours(board, id)
  if (around.length !== 2) return null
  if (board.links.some(sameLink(around[0], around[1]))) return null
  return [around[0], around[1]]
}

// Only reached by runaway boards: it keeps browser storage from filling up.
export const BOARD_FULL_MESSAGE = `This board has ${MAX_NODES} things on it, the most one board can hold. Start a new board to keep going.`

const isFull = (board: Board) => board.nodes.length >= MAX_NODES

export function addUserNode(board: Board, text: string, at: { x: number; y: number }, now = new Date()): OpResult {
  if (isFull(board)) return { ok: false, error: BOARD_FULL_MESSAGE }
  const clean = cleanText(text)
  if (!clean) return { ok: false, error: 'An idea needs some text' }
  const node: BoardNode = { id: newNodeId(), number: nextNumber(board), text: clean, kind: 'user', x: Math.round(at.x), y: Math.round(at.y) }
  return {
    ok: true,
    board: touch({ ...board, nodes: [...board.nodes, node] }, now),
    node,
  }
}

export function editUserNode(board: Board, id: string, text: string, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `Nothing numbered ${numberOf(board, id)}` }
  if (node.kind !== 'user' && !isTheme(node))
    return { ok: false, error: `${numberOf(board, id)} is a ${node.kind === 'spark' ? 'note' : node.kind}: only your own ideas can be edited` }
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
  if (!node) return { ok: false, error: `Nothing numbered ${numberOf(board, id)}` }
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

// Deletes several nodes as one change. With `reconnect`, any deleted node that sat in the middle
// of a chain has its two neighbours linked, so the trail isn't broken.
export function deleteNodes(board: Board, ids: string[], options: { reconnect?: boolean; now?: Date } = {}): Board {
  const gone = new Set(ids.filter((id) => findNode(board, id)))
  if (gone.size === 0) return board
  const bridges = options.reconnect ? [...gone].map((id) => chainAround(board, id)).filter((c): c is [string, string] => !!c) : []
  let next: Board = {
    ...board,
    nodes: board.nodes.filter((n) => !gone.has(n.id)),
    links: board.links.filter((l) => !gone.has(l.from) && !gone.has(l.to)),
  }
  for (const [a, b] of bridges) {
    if (gone.has(a) || gone.has(b) || next.links.some(sameLink(a, b))) continue
    next = { ...next, links: [...next.links, { from: a, to: b }] }
  }
  return touch(next, options.now ?? new Date())
}

// Any two nodes can be linked, whatever their kind. Links are undirected.
export function addLink(board: Board, a: string, b: string, now = new Date()): OpResult {
  if (a === b) return { ok: false, error: 'A node cannot link to itself' }
  for (const id of [a, b]) if (!findNode(board, id)) return { ok: false, error: `Nothing numbered ${numberOf(board, id)}` }
  if (board.links.some(sameLink(a, b))) return { ok: false, error: `${numberOf(board, a)} and ${numberOf(board, b)} are already linked` }
  return { ok: true, board: touch({ ...board, links: [...board.links, { from: a, to: b }] }, now) }
}

export function removeLink(board: Board, a: string, b: string, now = new Date()): OpResult {
  if (!board.links.some(sameLink(a, b))) return { ok: false, error: `${numberOf(board, a)} and ${numberOf(board, b)} aren't linked` }
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
  if (!findNode(board, fromId)) return { ok: false, error: `Nothing numbered ${numberOf(board, fromId)}` }
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
  if (!findNode(board, targetId)) return { ok: false, error: `Nothing numbered ${numberOf(board, targetId)}` }
  if (isFull(board)) return { ok: false, error: BOARD_FULL_MESSAGE }
  const text = cleanText(nudge.text)
  if (!text) return { ok: false, error: 'A nudge needs some text' }
  const node: BoardNode = { id: newNodeId(), number: nextNumber(board), text, kind: 'nudge', nudgeType: nudge.type, x: Math.round(at.x), y: Math.round(at.y) }
  const added = touch({ ...board, nodes: [...board.nodes, node] }, now)
  const linked = addLink(added, targetId, node.id, now)
  return linked.ok ? { ...linked, node } : linked
}

// Adds a note from the vending machine, or a theme you typed (themes are marked locked).
export function addNote(board: Board, note: { text: string; category: SparkCategory }, at: { x: number; y: number }, now = new Date()): OpResult {
  if (isFull(board)) return { ok: false, error: BOARD_FULL_MESSAGE }
  const text = cleanText(note.text)
  if (!text) return { ok: false, error: 'A note needs some text' }
  const node: BoardNode = {
    id: newNodeId(), number: nextNumber(board),
    text,
    kind: 'spark',
    category: note.category,
    ...(note.category === 'theme' ? { locked: true } : {}),
    x: Math.round(at.x),
    y: Math.round(at.y),
  }
  return { ok: true, board: touch({ ...board, nodes: [...board.nodes, node] }, now), node }
}

// Favourites or unfavourites anything on the board, for one person (you, when signed out).
export function toggleFavourite(board: Board, id: string, who = ME, now = new Date()): OpResult {
  const node = findNode(board, id)
  if (!node) return { ok: false, error: `Nothing numbered ${numberOf(board, id)}` }
  const { favouritedBy = [], ...rest } = node
  const next = favouritedBy.includes(who) ? favouritedBy.filter((h) => h !== who) : [...favouritedBy, who]
  const toggled: BoardNode = next.length ? { ...rest, favouritedBy: next } : rest
  return {
    ok: true,
    board: touch({ ...board, nodes: board.nodes.map((n) => (n.id === id ? toggled : n)) }, now),
    node: toggled,
  }
}

// Adds another theme to the board. Change one with /edit, like any idea.
export function addTheme(board: Board, text: string, at: { x: number; y: number }, now = new Date()): OpResult {
  return addNote(board, { text, category: 'theme' }, at, now)
}
