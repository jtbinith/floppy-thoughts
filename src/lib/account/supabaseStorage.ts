import type { SupabaseClient } from '@supabase/supabase-js'
import { parseBoard, type Board } from '../board'
import { applyChange, changeBetween, isEmpty, type BoardChange } from '../changes'
import { KEYS } from '../keys'
import { summaryOf, type BoardSummary, type LoadResult, type StorageAdapter } from '../storage'
import { Outbox, isConnectionProblem, type Pending, type SyncState } from './outbox'
import { boardFromRows, rowsOfChange, type BoardRow, type FavouriteRow, type LinkRow, type NodeRow } from './rows'

// Boards in your account, when you're signed in. Each change sends only the rows it touched
// (see changes.ts); the database's rules decide what you're allowed to change.
//
// Local-first: changes go into an outbox in this browser and out to the database in order, so
// nothing is lost if the connection drops. A copy of each board is kept here too, so boards open
// without a connection. Signing out clears both (see account.ts).
export class SupabaseStorage implements StorageAdapter {
  private readonly db: SupabaseClient
  // Your account id.
  private readonly me: string
  private readonly outbox: Outbox

  constructor(db: SupabaseClient, me: string) {
    this.db = db
    this.me = me
    this.outbox = new Outbox(KEYS.outbox(me), (p) => this.write(p))
  }

  // Whether changes are waiting, and whether the connection's down.
  get sync(): SyncState {
    return this.outbox.state
  }
  onSync(listener: (s: SyncState) => void) {
    return this.outbox.onState(listener)
  }
  stop() {
    this.outbox.stop()
  }

  // A whole board: a new one, or one uploaded from the browser.
  saveBoard(board: Board): Promise<void> {
    this.keepCopy(board)
    return this.outbox.add({ change: changeBetween(null, board), isNew: true, board: meta(board) })
  }

  saveChange(board: Board, change: BoardChange): Promise<void> {
    if (isEmpty(change)) return Promise.resolve()
    this.keepCopy(board)
    return this.outbox.add({ change, isNew: false, board: meta(board) })
  }

  // Every step can safely run twice, as a change is sent again if the connection drops halfway.
  private async write({ change, isNew, board }: Pending) {
    const rows = rowsOfChange(change, this.me)
    const id = change.boardId
    if (isNew) check(await this.db.from('boards').upsert({ id, name: board.name, created_at: board.createdAt }, { onConflict: 'id', ignoreDuplicates: true }))
    else if (rows.name !== undefined) check(await this.db.from('boards').update({ name: rows.name }).eq('id', id))
    // Removals first, so a number freed by a deleted box can be used again in the same change.
    for (const l of rows.removedLinks) check(await this.db.from('links').delete().match(l))
    if (rows.removedNodes.length) check(await this.db.from('nodes').delete().in('id', rows.removedNodes))
    // Adds new boxes and saves edited ones, changing only what's allowed (supabase/migrations).
    if (rows.nodes.length) check(await this.db.rpc('save_nodes', { board: id, rows: rows.nodes }))
    if (rows.links.length) check(await this.db.from('links').upsert(rows.links, { onConflict: 'node_a,node_b', ignoreDuplicates: true }))
    const { add, remove } = rows.favourites
    if (add.length) check(await this.db.from('favourites').upsert(add, { onConflict: 'node_id,user_id', ignoreDuplicates: true }))
    if (remove.length) check(await this.db.from('favourites').delete().eq('user_id', this.me).in('node_id', remove))
    // Last, as everything above counts as an edit: a board uploaded from the browser keeps the
    // "last edited" it had there.
    if (isNew) check(await this.db.rpc('keep_edited', { board: id, edited: board.updatedAt }))
  }

  async loadBoard(id: string): Promise<LoadResult> {
    // Known to be offline: straight to the copy, without waiting for tries that can't work.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const copy = this.copy(id)
      return copy ? { status: 'ok', board: copy } : { status: 'not-found' }
    }
    const { data, error } = await this.db.from('boards').select(EVERYTHING).eq('id', id).maybeSingle()
    const waiting = this.outbox.for(id)
    if (error) {
      // No connection: the copy in this browser (which already has your waiting changes).
      if (!isConnectionProblem(error.message)) throw new Error(error.message)
      const copy = this.copy(id)
      return copy ? { status: 'ok', board: copy } : { status: 'not-found' }
    }
    if (!data) {
      // Made here and not in the database yet. Otherwise it's gone (or you're not on it any
      // more), and so is its copy.
      const copy = waiting.length ? this.copy(id) : null
      if (!copy) localStorage.removeItem(KEYS.accountBoard(this.me, id))
      return copy ? { status: 'ok', board: copy } : { status: 'not-found' }
    }
    const result = this.toResult(data as unknown as Joined)
    if (result.status !== 'ok') return result
    // What's in the database, plus anything of yours still on its way there.
    const board = waiting.reduce(applyChange, result.board)
    this.keepCopy(board)
    return { status: 'ok', board }
  }

  async listBoards(): Promise<BoardSummary[]> {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    const { data, error } = offline ? { data: null, error: { message: 'offline' } } : await this.db.from('boards').select(EVERYTHING).order('updated_at', { ascending: false })
    if (error) {
      if (!isConnectionProblem(error.message)) throw new Error(error.message)
      return this.copies().map(summaryOf).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    const boards = (data as unknown as Joined[]).flatMap((row) => {
      const result = this.toResult(row)
      return result.status === 'ok' ? [this.outbox.for(row.id).reduce(applyChange, result.board)] : []
    })
    // Every board gets a copy here, so all of them open without a connection. Copies of boards
    // you're no longer on (deleted, or you were removed) go, unless you've changes still waiting.
    for (const b of boards) this.keepCopy(b)
    const seen = new Set(boards.map((b) => b.id))
    const others = this.copies().filter((b) => !seen.has(b.id))
    for (const b of others) if (!this.outbox.for(b.id).length) localStorage.removeItem(KEYS.accountBoard(this.me, b.id))
    // Boards made here that haven't reached the database yet.
    const waiting = others.filter((b) => this.outbox.for(b.id).length)
    return [...boards, ...waiting].map(summaryOf).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  // Owners delete the board for everyone. Anyone else deleting a board shared with them leaves it
  // instead: it goes from their list, and stays for everyone else. (This one needs a connection.)
  async deleteBoard(id: string): Promise<void> {
    const { data, error } = await this.db.from('boards').delete().eq('id', id).select('id')
    if (error) throw new Error(error.message)
    if (!data.length) check(await this.db.from('board_members').delete().eq('board_id', id).eq('user_id', this.me))
    localStorage.removeItem(KEYS.accountBoard(this.me, id))
  }

  private keepCopy(board: Board) {
    try {
      localStorage.setItem(KEYS.accountBoard(this.me, board.id), JSON.stringify(board))
    } catch {
      // A full browser just means no copy for offline; the database still has it.
    }
  }

  private copy(id: string): Board | null {
    try {
      const result = parseBoard(JSON.parse(localStorage.getItem(KEYS.accountBoard(this.me, id)) ?? 'null'))
      return result.ok ? result.board : null
    } catch {
      return null
    }
  }

  private copies(): Board[] {
    const prefix = KEYS.accountBoard(this.me, '')
    const ids: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) ids.push(key.slice(prefix.length))
    }
    return ids.flatMap((id) => this.copy(id) ?? [])
  }

  private toResult(row: Joined): LoadResult {
    const { nodes, links, ...board } = row
    const favourites = nodes.flatMap((n) => n.favourites)
    const result = boardFromRows(board, nodes, links, favourites, this.me)
    return result.ok ? { status: 'ok', board: result.board } : { status: 'invalid', errors: result.errors }
  }
}

const meta = (b: Board) => ({ name: b.name, createdAt: b.createdAt, updatedAt: b.updatedAt })

// Favourites belong to their box (that's how the database knows they're on the right board), so
// they come with the boxes.
const EVERYTHING = 'id, name, created_at, updated_at, nodes(*, favourites(*)), links(*)'
type Joined = BoardRow & { nodes: (NodeRow & { favourites: FavouriteRow[] })[]; links: LinkRow[] }

// Errors keep the database's own words, so a lost connection can be told from a refusal.
function check({ error }: { error: { message: string } | null }) {
  if (error) throw new Error(error.message)
}
