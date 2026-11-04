import { BOARD_VERSION, ME, parseBoard, type Board, type BoardNode, type Link } from '../board'
import type { BoardChange } from '../changes'

// A board in the app and the same board as rows in the database (supabase/migrations). The app
// calls you ME on every board; in the database you're your account id. That swap happens here
// and nowhere else, so the rest of the app never needs to know who's signed in.

export type BoardRow = { id: string; name: string; created_at: string; updated_at: string }
export type NodeRow = {
  id: string
  board_id: string
  number: number
  text: string
  kind: BoardNode['kind']
  category: BoardNode['category'] | null
  locked: boolean | null
  nudge_type: BoardNode['nudgeType'] | null
  x: number
  y: number
}
export type LinkRow = { board_id: string; node_a: string; node_b: string }
export type FavouriteRow = { board_id: string; node_id: string; user_id: string }

// A box's own fields, as save_nodes takes them (the board is given once, for all of them).
export const nodeFields = (n: BoardNode): Omit<NodeRow, 'board_id'> => ({
  id: n.id,
  number: n.number,
  text: n.text,
  kind: n.kind,
  category: n.category ?? null,
  locked: n.locked ?? null,
  nudge_type: n.nudgeType ?? null,
  x: n.x,
  y: n.y,
})

// Each pair once, smaller id first, as the database keeps them.
export const linkRow = (boardId: string, l: Link): LinkRow =>
  l.from < l.to ? { board_id: boardId, node_a: l.from, node_b: l.to } : { board_id: boardId, node_a: l.to, node_b: l.from }

export function boardFromRows(
  b: BoardRow,
  nodes: NodeRow[],
  links: LinkRow[],
  favourites: FavouriteRow[],
  me: string,
): ReturnType<typeof parseBoard> {
  const who = new Map<string, string[]>()
  for (const f of favourites) who.set(f.node_id, [...(who.get(f.node_id) ?? []), f.user_id === me ? ME : f.user_id])
  const board = {
    version: BOARD_VERSION,
    id: b.id,
    name: b.name,
    nodes: [...nodes]
      .sort((x, y) => x.number - y.number)
      .map((n) => ({
        id: n.id,
        number: n.number,
        text: n.text,
        kind: n.kind,
        x: n.x,
        y: n.y,
        ...(n.category ? { category: n.category } : {}),
        ...(n.locked !== null ? { locked: n.locked } : {}),
        ...(n.nudge_type ? { nudgeType: n.nudge_type } : {}),
        ...(who.has(n.id) ? { favouritedBy: who.get(n.id) } : {}),
      })),
    links: links.map((l) => ({ from: l.node_a, to: l.node_b })),
    createdAt: new Date(b.created_at).toISOString(),
    updatedAt: new Date(b.updated_at).toISOString(),
  }
  // Checked like anything else from outside the app.
  return parseBoard(board)
}

// Your own favourites on these boxes. The database only lets you add or remove your own, so
// other people's are left alone.
export const myFavourites = (boardId: string, nodes: BoardNode[], me: string): { add: FavouriteRow[]; remove: string[] } => ({
  add: nodes.filter((n) => n.favouritedBy?.includes(ME)).map((n) => ({ board_id: boardId, node_id: n.id, user_id: me })),
  remove: nodes.filter((n) => !n.favouritedBy?.includes(ME)).map((n) => n.id),
})

// What a change means in rows: what to delete first, then what to write.
export function rowsOfChange(change: BoardChange, me: string) {
  return {
    name: change.name,
    removedNodes: change.removedNodes,
    removedLinks: change.removedLinks.map((l) => linkRow(change.boardId, l)),
    nodes: change.nodes.map(nodeFields),
    links: change.links.map((l) => linkRow(change.boardId, l)),
    favourites: myFavourites(change.boardId, change.nodes, me),
  }
}

// A browser board, ready to upload to your account on first sign-in: new ids for the board and
// its boxes (older boards have box ids like n1, which the database doesn't take, and the same
// browser board could be uploaded by two accounts), with links and favourites following them. Numbers, text and positions stay exactly as they were.
export function forUpload(board: Board, newId: () => string = () => crypto.randomUUID()): Board {
  const ids = new Map(board.nodes.map((n) => [n.id, newId()]))
  return {
    ...board,
    id: newId(),
    nodes: board.nodes.map((n) => ({ ...n, id: ids.get(n.id)! })),
    links: board.links.map((l) => ({ from: ids.get(l.from)!, to: ids.get(l.to)! })),
  }
}
