import { describe, expect, it } from 'vitest'
import { KEYS, moveOldKeys } from './keys'

// A tiny in-memory Storage.
function memory(entries: Record<string, string>): Storage {
  const data = new Map(Object.entries(entries))
  return {
    get length() {
      return data.size
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  }
}

describe('moving old keys', () => {
  it('moves hunchhack: keys to floppy: ones, once', () => {
    const storage = memory({ 'hunchhack:board:b1': '{"x":1}', 'hunchhack:ui:panel': 'machine', 'other:thing': 'kept' })
    expect(moveOldKeys(storage)).toBe(2)
    expect(storage.getItem(KEYS.board('b1'))).toBe('{"x":1}')
    expect(storage.getItem(KEYS.panel)).toBe('machine')
    expect(storage.getItem('hunchhack:board:b1')).toBeNull()
    expect(storage.getItem('other:thing')).toBe('kept')
    expect(moveOldKeys(storage)).toBe(0)
  })

  it('never overwrites something already saved under the new name', () => {
    const storage = memory({ 'hunchhack:ui:panel': 'machine', 'floppy:ui:panel': 'commands' })
    moveOldKeys(storage)
    expect(storage.getItem(KEYS.panel)).toBe('commands')
  })
})
