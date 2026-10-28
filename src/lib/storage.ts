import { boardSchema, parseBoard, type Board } from './board'

export type BoardSummary = Pick<Board, 'id' | 'name' | 'mode' | 'updatedAt'>

export type LoadResult =
  | { status: 'ok'; board: Board }
  | { status: 'not-found' }
  | { status: 'invalid'; errors: string[] }

// The rest of the app only talks to this interface, never to localStorage directly.
// Methods are async so a Supabase adapter can be added later without changing callers (ADR 002).
export interface StorageAdapter {
  saveBoard(board: Board): Promise<void>
  loadBoard(id: string): Promise<LoadResult>
  listBoards(): Promise<BoardSummary[]>
  deleteBoard(id: string): Promise<void>
}

export class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full. Export or delete some boards to free up space.')
    this.name = 'StorageFullError'
  }
}

const KEY_PREFIX = 'hunchhack:board:'

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
    const summaries: BoardSummary[] = []
    for (const key of this.boardKeys()) {
      const result = this.parse(this.storage.getItem(key) ?? '')
      // Skip broken entries but leave them in storage, so nothing is lost silently.
      if (result.status !== 'ok') continue
      const { id, name, mode, updatedAt } = result.board
      summaries.push({ id, name, mode, updatedAt })
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
