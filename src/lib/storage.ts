import { boardSchema, parseBoard, type Board, type BoardNode } from './board'
import { KEYS } from './keys'

// What a board list shows: enough to recognise a board without opening it.
export type BoardSummary = Pick<Board, 'id' | 'name' | 'createdAt' | 'updatedAt'> & {
  // Every thought's text, for searching.
  thoughts: string[]
  // A tiny map of the board: boxes (0–1 across and down) and the links between them.
  sketch: { nodes: [x: number, y: number, tone: SketchTone][]; links: [number, number][] }
}

// How a box is coloured in the sketch: vending-machine notes by their category.
export type SketchTone = NonNullable<BoardNode['category']> | 'nudge' | 'user'

const SKETCH_NODES = 60

function sketchOf(board: Board): BoardSummary['sketch'] {
  const nodes = board.nodes.slice(0, SKETCH_NODES)
  if (nodes.length === 0) return { nodes: [], links: [] }
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
  const [w, h] = [Math.max(...xs) - minX, Math.max(...ys) - minY]
  const span = Math.max(w, h, 1)
  // Keep the board's shape, centred in the box.
  const at = (v: number, min: number, size: number) => Math.round(((v - min + (span - size) / 2) / span) * 100) / 100
  const index = new Map(nodes.map((n, i) => [n.id, i]))
  return {
    nodes: nodes.map((n) => [at(n.x, minX, w), at(n.y, minY, h), n.category ?? (n.kind === 'nudge' ? 'nudge' : 'user')]),
    links: board.links.flatMap((l) => {
      const [a, b] = [index.get(l.from), index.get(l.to)]
      return a === undefined || b === undefined ? [] : [[a, b] as [number, number]]
    }),
  }
}

export const summaryOf = (board: Board): BoardSummary => ({
  id: board.id,
  name: board.name,
  createdAt: board.createdAt,
  updatedAt: board.updatedAt,
  thoughts: board.nodes.map((n) => n.text),
  sketch: sketchOf(board),
})

// Puts one board's new summary into the list, newest first, without reading every board again.
// (With accounts and a server, this keeps each change to one small write.)
export function withSummary(list: BoardSummary[], board: Board): BoardSummary[] {
  const summary = summaryOf(board)
  return [summary, ...list.filter((b) => b.id !== board.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// A favourite, with the board it lives on.
export type Favourite = { boardId: string; boardName: string; node: BoardNode }

export type LoadResult =
  | { status: 'ok'; board: Board }
  | { status: 'not-found' }
  | { status: 'invalid'; errors: string[] }

// The rest of the app only talks to this interface, never to localStorage directly.
// Methods are async so a Supabase adapter can be added later without changing callers.
export interface StorageAdapter {
  saveBoard(board: Board): Promise<void>
  loadBoard(id: string): Promise<LoadResult>
  listBoards(): Promise<BoardSummary[]>
  deleteBoard(id: string): Promise<void>
}

export class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full. Delete some boards to free up space.')
    this.name = 'StorageFullError'
  }
}

const KEY_PREFIX = KEYS.boardPrefix

export class LocalStorageAdapter implements StorageAdapter {
  private readonly storage: Storage

  // `storage` is injectable so tests can use an in-memory fake.
  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
  }

  async saveBoard(board: Board): Promise<void> {
    // Never write a board we couldn't load back.
    const valid = boardSchema.parse(board)
    try {
      this.storage.setItem(KEY_PREFIX + valid.id, JSON.stringify(valid))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new StorageFullError()
      }
      throw error
    }
  }

  async loadBoard(id: string): Promise<LoadResult> {
    const raw = this.storage.getItem(KEY_PREFIX + id)
    if (raw === null) return { status: 'not-found' }
    return this.parse(raw)
  }

  async listBoards(): Promise<BoardSummary[]> {
    return this.allBoards().map(summaryOf)
  }

  private allBoards(): Board[] {
    const boards: Board[] = []
    for (const key of this.boardKeys()) {
      const result = this.parse(this.storage.getItem(key) ?? '')
      // Skip broken entries but leave them in storage, so nothing is lost silently.
      if (result.status === 'ok') boards.push(result.board)
    }
    return boards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async deleteBoard(id: string): Promise<void> {
    this.storage.removeItem(KEY_PREFIX + id)
  }

  private boardKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (key?.startsWith(KEY_PREFIX)) keys.push(key)
    }
    return keys
  }

  private parse(raw: string): LoadResult {
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return { status: 'invalid', errors: ['Saved board is not valid JSON'] }
    }
    const result = parseBoard(data)
    return result.ok ? { status: 'ok', board: result.board } : { status: 'invalid', errors: result.errors }
  }
}
