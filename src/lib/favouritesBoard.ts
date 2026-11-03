import { BOARD_VERSION, MAX_BOARD_NAME, type Board, type BoardNode } from './board'

// A new board with just this board's favourites, and the links between them, so you can
// look at the thoughts you liked on their own. Positions are kept, so the layout feels familiar.
export function favouritesBoard(from: Board, options: { id?: string; now?: Date } = {}): Board | null {
  const favourites = from.nodes.filter((n) => n.favourite)
  if (favourites.length === 0) return null
  const now = (options.now ?? new Date()).toISOString()
  // Fresh ids for the copies, numbered 1, 2, 3… on the new board.
  const newId = new Map(favourites.map((n) => [n.id, crypto.randomUUID()]))
  const nodes: BoardNode[] = favourites.map((n, i) => {
    // The copy isn't "the one" on the new board; that's a choice you make there.
    const { chosen: _, ...rest } = n
    return { ...rest, id: newId.get(n.id)!, number: i + 1 }
  })
  const links = from.links
    .filter((l) => newId.has(l.from) && newId.has(l.to))
    .map((l) => ({ from: newId.get(l.from)!, to: newId.get(l.to)! }))
  return {
    version: BOARD_VERSION,
    id: options.id ?? crypto.randomUUID(),
    name: `${from.name} · favourites`.slice(0, MAX_BOARD_NAME),
    nodes,
    links,
    createdAt: now,
    updatedAt: now,
  }
}
