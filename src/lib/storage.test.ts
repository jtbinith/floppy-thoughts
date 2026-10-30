import { beforeEach, describe, expect, it } from 'vitest'
import type { Board } from './board'
import { LocalStorageAdapter, StorageFullError } from './storage'

// Minimal in-memory stand-in for the browser's localStorage.
class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  quotaBytes = Infinity

  get length() {
    return this.data.size
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    if (value.length > this.quotaBytes) throw new DOMException('full', 'QuotaExceededError')
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  clear() {
    this.data.clear()
  }
}

function board(id: string, updatedAt = '2026-10-27T10:00:00Z'): Board {
  return {
    version: 2,
    id,
    name: `board ${id}`,
    nodes: [{ id: 'n1', text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 }],
    links: [],
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt,
  }
}

describe('LocalStorageAdapter', () => {
  let storage: MemoryStorage
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    storage = new MemoryStorage()
    adapter = new LocalStorageAdapter(storage)
  })

  it('saves and loads a board', async () => {
    await adapter.saveBoard(board('a'))
    expect(await adapter.loadBoard('a')).toEqual({ status: 'ok', board: board('a') })
  })

  it('overwrites a board when saved again', async () => {
    await adapter.saveBoard(board('a'))
    await adapter.saveBoard({ ...board('a'), name: 'renamed' })
    const result = await adapter.loadBoard('a')
    expect(result.status === 'ok' && result.board.name).toBe('renamed')
  })

  it('reports a missing board as not-found', async () => {
    expect(await adapter.loadBoard('nope')).toEqual({ status: 'not-found' })
  })

  it('reports corrupted JSON as invalid instead of crashing', async () => {
    storage.setItem('hunchhack:board:bad', '{not json')
    expect(await adapter.loadBoard('bad')).toEqual({
      status: 'invalid',
      errors: ['Saved board is not valid JSON'],
    })
  })

  it('reports tampered data as invalid', async () => {
    storage.setItem('hunchhack:board:bad', JSON.stringify({ ...board('bad'), version: 999 }))
    const result = await adapter.loadBoard('bad')
    expect(result.status).toBe('invalid')
  })

  it('refuses to save an invalid board', async () => {
    await expect(adapter.saveBoard({ ...board('a'), name: '   ' })).rejects.toThrow()
    expect(storage.length).toBe(0)
  })

  it('lists boards newest first, skipping broken ones and other keys', async () => {
    await adapter.saveBoard(board('old', '2026-10-01T00:00:00Z'))
    await adapter.saveBoard(board('new', '2026-10-27T00:00:00Z'))
    storage.setItem('hunchhack:board:broken', 'oops')
    storage.setItem('some-other-app', 'hello')

    const list = await adapter.listBoards()
    expect(list.map((b) => b.id)).toEqual(['new', 'old'])
    expect(list[0]).toMatchObject({ id: 'new', name: 'board new', updatedAt: '2026-10-27T00:00:00Z' })
    expect(list[0].nodeCount).toBeGreaterThan(0)
    // Broken data is skipped, not deleted.
    expect(storage.getItem('hunchhack:board:broken')).toBe('oops')
  })

  it('deletes a board', async () => {
    await adapter.saveBoard(board('a'))
    await adapter.deleteBoard('a')
    expect(await adapter.loadBoard('a')).toEqual({ status: 'not-found' })
  })

  it('throws a friendly error when storage is full', async () => {
    storage.quotaBytes = 10
    await expect(adapter.saveBoard(board('a'))).rejects.toBeInstanceOf(StorageFullError)
  })
})

describe('favourites across boards', () => {
  it('lists every favourite with the board it is on', async () => {
    const storage = new MemoryStorage()
    const adapter = new LocalStorageAdapter(storage)
    const a = board('a', '2026-10-01T00:00:00Z')
    const b = board('b', '2026-10-02T00:00:00Z')
    a.nodes[0] = { ...a.nodes[0], favourite: true }
    await adapter.saveBoard(a)
    await adapter.saveBoard(b)
    expect(await adapter.listFavourites()).toEqual([{ boardId: 'a', boardName: a.name, node: a.nodes[0] }])
  })
})
