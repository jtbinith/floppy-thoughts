import type { SparkCategory } from '../board'
import { SPARKS, type ContentCategory } from './content'

// Picks notes for the vending machine, ideally ones you haven't seen.

export type Spark = { text: string; category: SparkCategory }

const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)]

// One note from `category`, preferring ones not seen before. If all have been seen, any will do.
export function sparkFrom(category: ContentCategory, seen: ReadonlySet<string>, random: () => number, exclude: ReadonlySet<string> = new Set()): Spark {
  const pool = SPARKS[category].filter((t) => !exclude.has(t))
  const fresh = pool.filter((t) => !seen.has(t))
  return { text: pick(fresh.length ? fresh : pool, random), category }
}

