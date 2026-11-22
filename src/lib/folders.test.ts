import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  NO_FOLDERS,
  boardsInside,
  canMoveFolder,
  deleteFolder,
  folderOf,
  foldersIn,
  forgetBoards,
  makeFolder,
  moveFolder,
  pathTo,
  placeBoard,
  renameFolder,
  type Folders,
} from './folders'
import { AccountFolders, LocalFolders, stepsBetween } from './folderStore'

const now = new Date('2026-11-22T12:00:00Z')
const must = (f: Folders | null): Folders => {
  if (!f) throw new Error('expected a change')
  return f
}

// Hacks > OxHack > Day 1, and Uni at the top. Board b1 in OxHack, b2 in Day 1, b3 loose.
function sample(): Folders {
  let f = must(makeFolder(NO_FOLDERS, 'Hacks', null, 'hacks', now))
  f = must(makeFolder(f, 'OxHack', 'hacks', 'ox', now))
  f = must(makeFolder(f, 'Day 1', 'ox', 'day1', now))
  f = must(makeFolder(f, 'Uni', null, 'uni', now))
  f = must(placeBoard(f, 'b1', 'ox'))
  return must(placeBoard(f, 'b2', 'day1'))
}

describe('making and finding folders', () => {
  it('makes folders inside folders, listed by name', () => {
    const f = sample()
    expect(foldersIn(f, null).map((x) => x.name)).toEqual(['Hacks', 'Uni'])
    expect(foldersIn(f, 'hacks').map((x) => x.name)).toEqual(['OxHack'])
    expect(pathTo(f, 'day1').map((x) => x.name)).toEqual(['Hacks', 'OxHack', 'Day 1'])
    expect(pathTo(f, null)).toEqual([])
  })

  it('needs a name, and somewhere that exists', () => {
    expect(makeFolder(NO_FOLDERS, '   ', null, 'x', now)).toBeNull()
    expect(makeFolder(NO_FOLDERS, 'Lost', 'nowhere', 'x', now)).toBeNull()
    expect(must(makeFolder(NO_FOLDERS, '  Spaced   out ', null, 'x', now)).folders[0].name).toBe('Spaced out')
  })

  it('renames', () => {
    expect(must(renameFolder(sample(), 'uni', 'Year 1')).folders.find((x) => x.id === 'uni')?.name).toBe('Year 1')
    expect(renameFolder(sample(), 'uni', '')).toBeNull()
  })
})

describe('moving', () => {
  it('moves a board into a folder, to another, and out again', () => {
    let f = sample()
    expect(folderOf(f, 'b1')).toBe('ox')
    expect(folderOf(f, 'b3')).toBeNull()
    f = must(placeBoard(f, 'b1', 'uni'))
    expect(folderOf(f, 'b1')).toBe('uni')
    f = must(placeBoard(f, 'b1', null))
    expect(folderOf(f, 'b1')).toBeNull()
    expect(placeBoard(f, 'b1', 'nowhere')).toBeNull()
  })

  it('moves a folder, but never into itself or anything inside it', () => {
    const f = sample()
    expect(canMoveFolder(f, 'hacks', 'day1')).toBe(false)
    expect(canMoveFolder(f, 'hacks', 'hacks')).toBe(false)
    expect(moveFolder(f, 'hacks', 'day1')).toBeNull()
    expect(pathTo(must(moveFolder(f, 'ox', 'uni')), 'day1').map((x) => x.name)).toEqual(['Uni', 'OxHack', 'Day 1'])
    expect(must(moveFolder(f, 'ox', null)).folders.find((x) => x.id === 'ox')?.parentId).toBeNull()
  })
})

describe('deleting a folder', () => {
  it('keeping what is inside moves it up to where the folder was', () => {
    const { folders: f, boards } = deleteFolder(sample(), 'ox', true)!
    expect(boards).toEqual([])
    expect(folderOf(f, 'b1')).toBe('hacks')
    expect(f.folders.find((x) => x.id === 'day1')?.parentId).toBe('hacks')
    expect(folderOf(f, 'b2')).toBe('day1')
  })

  it('keeping what is inside a top folder leaves it loose', () => {
    const { folders: f } = deleteFolder(sample(), 'hacks', true)!
    expect(foldersIn(f, null).map((x) => x.name)).toEqual(['OxHack', 'Uni'])
  })

  it('otherwise everything inside goes, and says which boards to delete', () => {
    const before = sample()
    expect(boardsInside(before, 'hacks').sort()).toEqual(['b1', 'b2'])
    const { folders: f, boards } = deleteFolder(before, 'hacks', false)!
    expect(boards.sort()).toEqual(['b1', 'b2'])
    expect(f.folders.map((x) => x.id)).toEqual(['uni'])
    expect(f.placed).toEqual({})
  })

  it('forgets boards that are gone', () => {
    expect(forgetBoards(sample(), (b) => b !== 'b1').placed).toEqual({ b2: 'day1' })
  })
})

describe('saving', () => {
  it('works out the steps, outer folders first', () => {
    const before = sample()
    let after = must(makeFolder(before, 'Week 2', 'uni', 'w2', now))
    after = must(makeFolder(after, 'Labs', 'w2', 'labs', now))
    after = must(renameFolder(after, 'uni', 'Year 1'))
    after = must(placeBoard(after, 'b3', 'labs'))
    after = must(placeBoard(after, 'b1', null))
    after = deleteFolder(after, 'day1', true)!.folders
    const steps = stepsBetween(before, after)
    expect(steps.added.map((x) => x.id)).toEqual(['w2', 'labs'])
    expect(steps.changed.map((x) => x.id)).toEqual(['uni'])
    expect(steps.removed).toEqual(['day1'])
    expect(steps.placed).toEqual([['b2', 'ox'], ['b3', 'labs']])
    expect(steps.unplaced).toEqual(['b1'])
  })

  it('keeps folders in the browser', async () => {
    const map = new Map<string, string>()
    const fake = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) } as Storage
    const store = new LocalFolders(fake, 'f')
    expect(await store.load()).toEqual(NO_FOLDERS)
    await store.save(NO_FOLDERS, sample())
    expect(await store.load()).toEqual(sample())
    map.set('f', '{"broken":')
    expect(await store.load()).toEqual(NO_FOLDERS)
  })
})

describe('saving to an account', () => {
  // A stand-in for the database client that records each request.
  function fakeDb() {
    const calls: string[] = []
    const ok = Promise.resolve({ data: [], error: null })
    const chain = (desc: string): unknown =>
      new Proxy(() => {}, {
        get: (_t, key) => (key === 'then' ? ok.then.bind(ok) : (...args: unknown[]) => chain(`${desc}.${String(key)}(${JSON.stringify(args)})`)),
        apply: () => chain(desc),
      })
    const db = { from: (table: string) => new Proxy({}, { get: (_t, op) => (...args: unknown[]) => (calls.push(`${table}.${String(op)} ${JSON.stringify(args)}`), chain(table)) }) }
    return { db: db as unknown as SupabaseClient, calls }
  }

  it('adds a board to a folder the first time, then only changes its folder (never an upsert)', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    const { db, calls } = fakeDb()
    const store = new AccountFolders(db, 'me')
    const before = sample()
    const after = must(placeBoard(must(placeBoard(before, 'b3', 'uni')), 'b1', 'uni'))
    await store.save(before, after)
    expect(calls).toEqual(['board_folders.insert [[{"board_id":"b3","folder_id":"uni"}]]', 'board_folders.update [{"folder_id":"uni"}]'])
    expect(calls.some((c) => c.includes('upsert'))).toBe(false)
    vi.unstubAllGlobals()
  })
})
