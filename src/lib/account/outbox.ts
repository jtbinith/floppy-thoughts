import type { BoardChange } from '../changes'

// Changes waiting to reach your account. Each one is kept in this browser until it's safely
// saved, and they go out in order. If the connection drops, they wait (and survive a reload)
// and go out when it's back, so nothing you do while offline is lost.
//
// The list in storage is the one true list, read fresh each time, so two tabs never lose each
// other's changes. (If both send the same one, that's fine: every save can safely run twice.)

export type Pending = {
  id: string
  change: BoardChange
  // A whole new board (made here, or uploaded on first sign-in), not a change to one.
  isNew: boolean
  board: { name: string; createdAt: string; updatedAt: string }
}

export type SyncState = { waiting: number; offline: boolean }

// The connection's gone (as opposed to the database saying no, which waiting won't fix).
export const isConnectionProblem = (e: unknown) =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) ||
  /fetch|network|load failed|timed? ?out|offline/i.test(e instanceof Error ? e.message : String(e))

const RETRY_FIRST = 2000
const RETRY_MOST = 30000

export class Outbox {
  private readonly waiters = new Map<string, { resolve: () => void; reject: (e: unknown) => void }>()
  private sending = false
  private offline = false
  private retryIn = RETRY_FIRST
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly listeners = new Set<(s: SyncState) => void>()
  private readonly key: string
  private readonly send: (p: Pending) => Promise<void>
  private readonly store: Storage

  constructor(key: string, send: (p: Pending) => Promise<void>, store: Storage = localStorage) {
    this.key = key
    this.send = send
    this.store = store
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline)
    // Anything left from last time goes out now.
    if (this.read().length) void this.flush()
  }

  private readonly onOnline = () => void this.flush()

  // For signing out (and tests): no more tries from this one.
  stop() {
    clearTimeout(this.timer)
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline)
  }

  // Resolves once this one is saved; rejects if the database refuses it.
  add(item: Omit<Pending, 'id'>): Promise<void> {
    const pending: Pending = { ...item, id: crypto.randomUUID() }
    this.write([...this.read(), pending])
    const done = new Promise<void>((resolve, reject) => this.waiters.set(pending.id, { resolve, reject }))
    void this.flush()
    return done
  }

  // Waiting changes for one board, oldest first (to put on top of what the database has).
  for(boardId: string): BoardChange[] {
    return this.read().filter((p) => p.change.boardId === boardId).map((p) => p.change)
  }

  get state(): SyncState {
    return { waiting: this.read().length, offline: this.offline }
  }

  onState(listener: (s: SyncState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async flush(): Promise<void> {
    if (this.sending) return
    this.sending = true
    clearTimeout(this.timer)
    try {
      for (let next = this.read()[0]; next; next = this.read()[0]) {
        try {
          await this.send(next)
        } catch (e) {
          if (isConnectionProblem(e)) {
            this.offline = true
            this.tell()
            // Try again a little later (and straight away when the browser says it's back).
            this.timer = setTimeout(() => void this.flush(), this.retryIn)
            this.retryIn = Math.min(this.retryIn * 2, RETRY_MOST)
            return
          }
          // The database said no: waiting won't help, so it's dropped and reported.
          this.done(next, e)
          continue
        }
        this.done(next)
      }
      this.offline = false
      this.retryIn = RETRY_FIRST
      this.tell()
    } finally {
      this.sending = false
    }
  }

  private done(item: Pending, error?: unknown) {
    this.write(this.read().filter((p) => p.id !== item.id))
    const waiter = this.waiters.get(item.id)
    this.waiters.delete(item.id)
    if (error === undefined) waiter?.resolve()
    else waiter?.reject(error)
    this.tell()
  }

  private tell() {
    for (const l of this.listeners) l(this.state)
  }

  private read(): Pending[] {
    try {
      const saved = JSON.parse(this.store.getItem(this.key) ?? '[]') as unknown
      return Array.isArray(saved) ? (saved as Pending[]) : []
    } catch {
      return []
    }
  }

  private write(items: Pending[]) {
    if (items.length) this.store.setItem(this.key, JSON.stringify(items))
    else this.store.removeItem(this.key)
  }
}
