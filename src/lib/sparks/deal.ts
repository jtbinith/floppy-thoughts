import type { SparkCategory } from '../board'
import { CONTENT_CATEGORIES, SPARKS, type ContentCategory } from './content'

// Deals sparks that clash: each one from a different category, ideally ones you haven't seen.

export type Spark = { text: string; category: SparkCategory }

const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)]

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// One spark from `category`, preferring ones not seen before. If all have been seen, any will do.
export function sparkFrom(category: ContentCategory, seen: ReadonlySet<string>, random: () => number, exclude: ReadonlySet<string> = new Set()): Spark {
  const pool = SPARKS[category].filter((t) => !exclude.has(t))
  const fresh = pool.filter((t) => !seen.has(t))
  return { text: pick(fresh.length ? fresh : pool, random), category }
}

// `count` sparks, each from a different category and not in `avoid` categories.
export function dealSparks(
  count: number,
  options: { seen?: ReadonlySet<string>; avoid?: readonly SparkCategory[]; random?: () => number } = {},
): Spark[] {
  const random = options.random ?? Math.random
  const seen = options.seen ?? new Set<string>()
  const avoid = new Set(options.avoid ?? [])
  const categories = shuffle(
    CONTENT_CATEGORIES.filter((c) => !avoid.has(c)),
    random,
  ).slice(0, count)
  return categories.map((c) => sparkFrom(c, seen, random))
}

// A replacement for one spark: from a category none of the other sparks use, and never the same text.
export function swapFor(
  current: Spark,
  others: readonly Spark[],
  options: { seen?: ReadonlySet<string>; random?: () => number } = {},
): Spark {
  const random = options.random ?? Math.random
  const taken = new Set(others.map((s) => s.category))
  const choices = CONTENT_CATEGORIES.filter((c) => !taken.has(c))
  const category = pick(choices.length ? choices : CONTENT_CATEGORIES, random)
  return sparkFrom(category, options.seen ?? new Set(), random, new Set([current.text]))
}
