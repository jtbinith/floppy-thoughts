import { KEYS } from '../keys'

// Remembers which notes you've already had from the machine, so it rarely repeats them.
const KEY = KEYS.seenNotes
const LIMIT = 300

export function loadSeen(storage: Storage = localStorage): Set<string> {
  try {
    const data: unknown = JSON.parse(storage.getItem(KEY) ?? '[]')
    return new Set(Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function rememberSeen(texts: string[], storage: Storage = localStorage): void {
  const seen = [...loadSeen(storage), ...texts]
  storage.setItem(KEY, JSON.stringify([...new Set(seen)].slice(-LIMIT)))
}
