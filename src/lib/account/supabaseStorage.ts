import type { SupabaseClient } from '@supabase/supabase-js'
import type { Board } from '../board'
import { changeBetween, isEmpty, type BoardChange } from '../changes'
import { summaryOf, type BoardSummary, type LoadResult, type StorageAdapter } from '../storage'
import { boardFromRows, rowsOfChange, type BoardRow, type FavouriteRow, type LinkRow, type NodeRow } from './rows'

// Boards in your account, when you're signed in. Each change sends only the rows it touched
// (see changes.ts); the database's rules decide what you're allowed to change.
export class SupabaseStorage implements StorageAdapter {
  // Saves go out one after another, so a link never arrives before the box it points to.
  private queue: Promise<void> = Promise.resolve()

  private readonly db: SupabaseClient
  // Your account id.
  private readonly me: string

  constructor(db: SupabaseClient, me: string) {
    this.db = db
    this.me = me
  }

  private inTurn(save: () => Promise<void>): Promise<void> {
    const next = this.queue.then(save)
    // One failed save shouldn't stop the ones after it.
    this.queue = next.catch(() => {})
    return next
  }

  // A whole board: a new one, or one uploaded from the browser.
  saveBoard(board: Board): Promise<void> {
    return this.inTurn(() => this.write(changeBetween(null, board), board, true))
  }

  saveChange(board: Board, change: BoardChange): Promise<void> {
    if (isEmpty(change)) return Promise.resolve()
    return this.inTurn(() => this.write(change, board))
  }

  private async write(change: BoardChange, board: Board, isNew = false) {
    const rows = rowsOfChange(change, this.me)
    const id = change.boardId
    if (isNew) check(await this.db.from('boards').insert({ id, name: board.name, created_at: board.createdAt }))
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
  }

  async loadBoard(id: string): Promise<LoadResult> {
    const { data, error } = await this.db.from('boards').select(EVERYTHING).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return { status: 'not-found' }
    return this.toResult(data as unknown as Joined)
  }

  async listBoards(): Promise<BoardSummary[]> {
    const { data, error } = await this.db.from('boards').select(EVERYTHING).order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as unknown as Joined[]).flatMap((row) => {
      const result = this.toResult(row)
      return result.status === 'ok' ? [summaryOf(result.board)] : []
    })
  }

  // Owners delete the board for everyone. (Leaving a board you were invited to comes with sharing.)
  deleteBoard(id: string): Promise<void> {
    return this.inTurn(async () => check(await this.db.from('boards').delete().eq('id', id)))
  }

  private toResult(row: Joined): LoadResult {
    const { nodes, links, ...board } = row
    const favourites = nodes.flatMap((n) => n.favourites)
    const result = boardFromRows(board, nodes, links, favourites, this.me)
    return result.ok ? { status: 'ok', board: result.board } : { status: 'invalid', errors: result.errors }
  }
}

// Favourites belong to their box (that's how the database knows they're on the right board), so
// they come with the boxes.
const EVERYTHING = 'id, name, created_at, updated_at, nodes(*, favourites(*)), links(*)'
type Joined = BoardRow & { nodes: (NodeRow & { favourites: FavouriteRow[] })[]; links: LinkRow[] }

function check({ error }: { error: { message: string } | null }) {
  if (error) throw new Error(`Couldn't save to your account: ${error.message}`)
}
