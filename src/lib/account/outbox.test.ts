import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardChange } from '../changes'
import { Outbox, isConnectionProblem, type Pending } from './outbox'

class MemoryStorage {
  data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, v)
  removeItem = (k: string) => void this.data.delete(k)
}

const change = (boardId: string, name: string): BoardChange => ({ boardId, name, nodes: [], removedNodes: [], links: [], removedLinks: [], updatedAt: '2026-11-04T10:00:00Z' })
const item = (name: string) => ({ change: change('b1', name), isNew: false, board: { name, createdAt: '', updatedAt: '' } })
const offline = () => Promise.reject(new Error('TypeError: Failed to fetch'))

describe('outbox', () => {
  let store: MemoryStorage
  beforeEach(() => {
    store = new MemoryStorage()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('sends changes in order', async () => {
    const sent: string[] = []
    const box = new Outbox('q', async (p) => void sent.push(p.change.name!), store as unknown as Storage)
    await Promise.all([box.add(item('one')), box.add(item('two')), box.add(item('three'))])
    expect(sent).toEqual(['one', 'two', 'three'])
    expect(box.state).toEqual({ waiting: 0, offline: false })
    expect(store.data.size).toBe(0)
  })

  it('keeps changes while offline, through a reload, and sends them when back', async () => {
    let online = false
    const sent: string[] = []
    const send = (p: Pending) => (online ? Promise.resolve(void sent.push(p.change.name!)) : offline())
    const box = new Outbox('q', send, store as unknown as Storage)
    void box.add(item('one'))
    void box.add(item('two'))
    await vi.advanceTimersByTimeAsync(0)
    expect(box.state).toEqual({ waiting: 2, offline: true })
    expect(box.for('b1').map((c) => c.name)).toEqual(['one', 'two'])

    // The page reloads while still offline: the changes are still there.
    box.stop()
    const again = new Outbox('q', send, store as unknown as Storage)
    await vi.advanceTimersByTimeAsync(0)
    expect(again.state.waiting).toBe(2)

    // Back online: the next try sends them, in order.
    online = true
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent).toEqual(['one', 'two'])
    expect(again.state).toEqual({ waiting: 0, offline: false })
  })

  it('drops and reports a change the database refuses, and carries on', async () => {
    const sent: string[] = []
    const box = new Outbox('q', async (p) => {
      if (p.change.name === 'bad') throw new Error('new row violates row-level security policy')
      sent.push(p.change.name!)
    }, store as unknown as Storage)
    const bad = box.add(item('bad'))
    const good = box.add(item('good'))
    await expect(bad).rejects.toThrow('row-level security')
    await good
    expect(sent).toEqual(['good'])
  })

  it('tells a lost connection from a refusal', () => {
    expect(isConnectionProblem(new Error('TypeError: Failed to fetch'))).toBe(true)
    expect(isConnectionProblem(new Error('Load failed'))).toBe(true)
    expect(isConnectionProblem(new Error('permission denied for table boards'))).toBe(false)
  })
})
