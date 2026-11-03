import type { BoardSummary } from './storage'

// Searching and sorting the boards page.

export const SORTS = {
  edited: 'last edited',
  newest: 'newest',
  oldest: 'oldest',
  name: 'name (A–Z)',
} as const
export type Sort = keyof typeof SORTS

const by: Record<Sort, (a: BoardSummary, b: BoardSummary) => number> = {
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  name: (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }),
}

// Boards whose name or any thought contains every word searched for, in the chosen order.
export function findBoards(boards: BoardSummary[], search: string, sort: Sort): BoardSummary[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (b: BoardSummary) => {
    const text = [b.name, ...b.thoughts].join('\n').toLowerCase()
    return words.every((w) => text.includes(w))
  }
  return boards.filter(matches).sort(by[sort])
}

export const isSort = (value: unknown): value is Sort => typeof value === 'string' && value in SORTS
