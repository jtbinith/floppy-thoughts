import type { SupabaseClient } from '@supabase/supabase-js'
import { foldersSchema, NO_FOLDERS, type Folder, type Folders } from './folders'
import { KEYS } from './keys'

// Where your folders are kept: in this browser, or in your account once you're signed in. Each
// change is worked out in folders.ts as a new copy; `save` stores the step from before to after.
export interface FolderStore {
  load(): Promise<Folders>
  save(before: Folders, after: Folders): Promise<void>
  // The folders as last seen, straight away (no waiting), or null if they've never been loaded here.
  // The boards page shows these while it loads, so boards don't flash up in the wrong place.
  kept(): Folders | null
}

const read = (storage: Storage, key: string): Folders | null => {
  try {
    const result = foldersSchema.safeParse(JSON.parse(storage.getItem(key) ?? 'null'))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

// In this browser: everything as one item.
export class LocalFolders implements FolderStore {
  private readonly storage: Storage
  private readonly key: string
  constructor(storage: Storage = window.localStorage, key: string = KEYS.folders) {
    this.storage = storage
    this.key = key
  }
  async load(): Promise<Folders> {
    return this.kept()
  }
  kept(): Folders {
    return read(this.storage, this.key) ?? NO_FOLDERS
  }
  // Only what's been saved here, or null.
  saved(): Folders | null {
    return read(this.storage, this.key)
  }
  async save(_before: Folders, after: Folders): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify(after))
  }
  clear() {
    this.storage.removeItem(this.key)
  }
}

type FolderRow = { id: string; name: string; parent_id: string | null; created_at: string }
type PlacedRow = { board_id: string; folder_id: string }

// In your account: only the rows a change touched. Folders need a connection to change (like
// deleting a board); a copy is kept here so they still show without one, and goes at sign-out.
export class AccountFolders implements FolderStore {
  private readonly db: SupabaseClient
  private readonly copy: LocalFolders
  constructor(db: SupabaseClient, me: string) {
    this.db = db
    this.copy = new LocalFolders(localStorage, KEYS.accountFolders(me))
  }

  async load(): Promise<Folders> {
    const [folders, placed] = await Promise.all([
      this.db.from('folders').select('id, name, parent_id, created_at'),
      this.db.from('board_folders').select('board_id, folder_id'),
    ])
    if (folders.error || placed.error) return this.copy.load()
    const loaded: Folders = {
      folders: (folders.data as FolderRow[]).map((r) => ({ id: r.id, name: r.name, parentId: r.parent_id, createdAt: r.created_at })),
      placed: Object.fromEntries((placed.data as PlacedRow[]).map((r) => [r.board_id, r.folder_id])),
    }
    await this.copy.save(NO_FOLDERS, loaded)
    return loaded
  }

  kept(): Folders | null {
    return this.copy.saved()
  }

  async save(before: Folders, after: Folders): Promise<void> {
    const steps = stepsBetween(before, after)
    // New folders first, outer ones before the ones inside them, then changed ones.
    if (steps.added.length)
      check(await this.db.from('folders').insert(steps.added.map((f) => ({ id: f.id, name: f.name, parent_id: f.parentId, created_at: f.createdAt }))))
    for (const f of steps.changed) check(await this.db.from('folders').update({ name: f.name, parent_id: f.parentId }).eq('id', f.id))
    // Boards moved (before any folder goes, which would take its boards' rows with it).
    // A board filed for the first time is added; one already in a folder just changes folder.
    // (The database only lets the folder change on a row, never which board it's for.)
    const filed = steps.placed.filter(([board]) => !(board in before.placed))
    if (filed.length) check(await this.db.from('board_folders').insert(filed.map(([board_id, folder_id]) => ({ board_id, folder_id }))))
    for (const [board, folder] of steps.placed.filter(([board]) => board in before.placed))
      check(await this.db.from('board_folders').update({ folder_id: folder }).eq('board_id', board))
    if (steps.unplaced.length) check(await this.db.from('board_folders').delete().in('board_id', steps.unplaced))
    if (steps.removed.length) check(await this.db.from('folders').delete().in('id', steps.removed))
    await this.copy.save(before, after)
  }
}

// What changed between two copies of your folders, in an order that's safe to send.
export function stepsBetween(before: Folders, after: Folders) {
  const was = new Map(before.folders.map((f) => [f.id, f]))
  const now = new Set(after.folders.map((f) => f.id))
  const depth = (f: Folder): number => {
    let d = 0
    for (let at = f.parentId; at && d < 100; d++) at = after.folders.find((x) => x.id === at)?.parentId ?? null
    return d
  }
  const added = after.folders.filter((f) => !was.has(f.id)).sort((a, b) => depth(a) - depth(b))
  const changed = after.folders.filter((f) => {
    const old = was.get(f.id)
    return old && (old.name !== f.name || old.parentId !== f.parentId)
  })
  const removed = before.folders.filter((f) => !now.has(f.id)).map((f) => f.id)
  const placed = Object.entries(after.placed).filter(([board, folder]) => before.placed[board] !== folder)
  const unplaced = Object.keys(before.placed).filter((board) => !(board in after.placed))
  return { added, changed, removed, placed, unplaced }
}

function check({ error }: { error: { message: string } | null }) {
  if (error) throw new Error(error.message)
}
