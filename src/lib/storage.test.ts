import { beforeEach, describe, expect, it } from 'vitest'
import type { Board } from './board'
import { changeBetween } from './changes'
import { LocalStorageAdapter, StorageFullError, summaryOf, withSummary } from './storage'

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
    version: 4,
    id,
    name: `board ${id}`,
    nodes: [{ id: 'n1', number: 1, text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 }],
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

  it('saves a change by writing the board after it, and skips one that touched nothing', async () => {
    await adapter.saveBoard(board('a'))
    let writes = 0
    const setItem = storage.setItem.bind(storage)
    storage.setItem = (k, v) => {
      writes++
      setItem(k, v)
    }
    const edited = { ...board('a'), nodes: [{ ...board('a').nodes[0], text: 'tape' }] }
    await adapter.saveChange(edited, changeBetween(board('a'), edited))
    await adapter.saveChange(edited, changeBetween(edited, edited))
    expect(writes).toBe(1)
    const result = await adapter.loadBoard('a')
    expect(result.status === 'ok' && result.board.nodes[0].text).toBe('tape')
  })

  it('reports a missing board as not-found', async () => {
    expect(await adapter.loadBoard('nope')).toEqual({ status: 'not-found' })
  })

  it('reports corrupted JSON as invalid instead of crashing', async () => {
    storage.setItem('floppy:board:bad', '{not json')
    expect(await adapter.loadBoard('bad')).toEqual({
      status: 'invalid',
      errors: ['Saved board is not valid JSON'],
    })
  })

  it('reports tampered data as invalid', async () => {
    storage.setItem('floppy:board:bad', JSON.stringify({ ...board('bad'), version: 999 }))
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
    storage.setItem('floppy:board:broken', 'oops')
    storage.setItem('some-other-app', 'hello')

    const list = await adapter.listBoards()
    expect(list.map((b) => b.id)).toEqual(['new', 'old'])
    expect(list[0]).toMatchObject({ id: 'new', name: 'board new', updatedAt: '2026-10-27T00:00:00Z' })
    // Broken data is skipped, not deleted.
    expect(storage.getItem('floppy:board:broken')).toBe('oops')
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

describe('updating the board list after a save', () => {
  it('swaps in just the changed board, newest first', () => {
    const list = [summaryOf(board('b', '2026-10-02T00:00:00Z')), summaryOf(board('a', '2026-10-01T00:00:00Z'))]
    const edited = { ...board('a', '2026-10-03T00:00:00Z'), name: 'renamed' }
    const next = withSummary(list, edited)
    expect(next.map((b) => [b.id, b.name])).toEqual([
      ['a', 'renamed'],
      ['b', 'board b'],
    ])
  })

  it('adds a board it has not seen', () => {
    expect(withSummary([], board('c'))).toHaveLength(1)
  })
})

describe('board summaries', () => {
  const b: Board = {
    ...board('a'),
    nodes: [
      { id: 'n1', number: 1, text: 'first', kind: 'user', x: 0, y: 0 },
      { id: 'n2', number: 2, text: 'Time', kind: 'spark', category: 'theme', x: 100, y: 0 },
      { id: 'n3', number: 3, text: 'second', kind: 'user', x: 100, y: 50 },
      { id: 'n4', number: 4, text: 'newest', kind: 'nudge', nudgeType: 'related', x: 200, y: 100 },
    ],
    links: [{ from: 'n1', to: 'n4' }],
  }

  it('sketch the boxes on a 0–1 scale, centred, with notes coloured by category', () => {
    const { nodes, links } = summaryOf(b).sketch
    expect(nodes[0]).toEqual([0, 0.25, 'user'])
    expect(nodes[1][2]).toBe('theme')
    expect(nodes[3]).toEqual([1, 0.75, 'nudge'])
    expect(links).toEqual([[0, 3]])
  })

  it('cope with an empty board', () => {
    expect(summaryOf({ ...board('e'), nodes: [], links: [] })).toMatchObject({ sketch: { nodes: [], links: [] } })
  })
})
