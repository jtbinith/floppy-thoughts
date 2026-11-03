import type { Board, BoardNode, Link } from './board'

// What one change to a board touched: the boxes added or edited (whole boxes), the boxes removed,
// and the links added or removed. Saved like this, a shared board sends only these rows, and two
// people editing different boxes never overwrite each other. Browser-only boards still save whole.

export type BoardChange = {
  boardId: string
  // Set only when the board's own name changed.
  name?: string
  nodes: BoardNode[]
  removedNodes: string[]
  links: Link[]
  removedLinks: Link[]
  updatedAt: string
}

// Links have no direction, so a→b and b→a are the same link.
const linkKey = (l: Link) => (l.from < l.to ? `${l.from}|${l.to}` : `${l.to}|${l.from}`)

function sameNode(a: BoardNode, b: BoardNode): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof BoardNode)[])
  for (const k of keys) {
    const x = a[k]
    const y = b[k]
    if (Array.isArray(x) || Array.isArray(y)) {
      if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.some((v, i) => v !== y[i])) return false
    } else if (x !== y) return false
  }
  return true
}

// `previous` is null for a board that's new here: then everything on it counts as added.
export function changeBetween(previous: Board | null, next: Board): BoardChange {
  const before = new Map((previous?.nodes ?? []).map((n) => [n.id, n]))
  const after = new Set(next.nodes.map((n) => n.id))
  const linksBefore = new Map((previous?.links ?? []).map((l) => [linkKey(l), l]))
  const linksAfter = new Map(next.links.map((l) => [linkKey(l), l]))
  return {
    boardId: next.id,
    ...(previous?.name === next.name ? {} : { name: next.name }),
    nodes: next.nodes.filter((n) => {
      const old = before.get(n.id)
      return !old || !sameNode(old, n)
    }),
    removedNodes: [...before.keys()].filter((id) => !after.has(id)),
    links: [...linksAfter].filter(([k]) => !linksBefore.has(k)).map(([, l]) => l),
    removedLinks: [...linksBefore].filter(([k]) => !linksAfter.has(k)).map(([, l]) => l),
    updatedAt: next.updatedAt,
  }
}

export const isEmpty = (c: BoardChange) =>
  c.name === undefined && !c.nodes.length && !c.removedNodes.length && !c.links.length && !c.removedLinks.length

// The other way round: brings a board up to date with a change (someone else's, arriving live).
// Edited boxes stay where they are in the list; new ones go on the end.
export function applyChange(board: Board, change: BoardChange): Board {
  const changed = new Map(change.nodes.map((n) => [n.id, n]))
  const removed = new Set(change.removedNodes)
  const kept = board.nodes.filter((n) => !removed.has(n.id)).map((n) => changed.get(n.id) ?? n)
  const existing = new Set(board.nodes.map((n) => n.id))
  const added = change.nodes.filter((n) => !existing.has(n.id))
  const gone = new Set(change.removedLinks.map(linkKey))
  const links = board.links.filter((l) => !gone.has(linkKey(l)) && !removed.has(l.from) && !removed.has(l.to))
  const have = new Set(links.map(linkKey))
  return {
    ...board,
    ...(change.name === undefined ? {} : { name: change.name }),
    nodes: [...kept, ...added],
    links: [...links, ...change.links.filter((l) => !have.has(linkKey(l)))],
    updatedAt: change.updatedAt > board.updatedAt ? change.updatedAt : board.updatedAt,
  }
}
