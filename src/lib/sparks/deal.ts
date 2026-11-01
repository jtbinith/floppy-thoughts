import type { SparkCategory } from '../board'
import { CONTENT_CATEGORIES, SPARKS, type ContentCategory } from './content'

// Deals notes that clash: each from a different category where possible, ideally ones you haven't seen.

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

// `count` notes, not in `avoid` categories. Categories only repeat once every one has been used,
// and the same text never comes up twice.
export function dealSparks(
  count: number,
  options: { seen?: ReadonlySet<string>; avoid?: readonly SparkCategory[]; random?: () => number } = {},
): Spark[] {
  const random = options.random ?? Math.random
  const seen = options.seen ?? new Set<string>()
  const avoid = new Set(options.avoid ?? [])
  const allowed = CONTENT_CATEGORIES.filter((c) => !avoid.has(c))
  if (allowed.length === 0) return []
  const dealt: Spark[] = []
  let round: ContentCategory[] = []
  while (dealt.length < count) {
    if (round.length === 0) round = shuffle(allowed, random)
    const category = round.shift()!
    dealt.push(sparkFrom(category, seen, random, new Set(dealt.map((s) => s.text))))
  }
  return dealt
}
