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

// A replacement for one note: from the same category (you chose it), never the same text.
// A theme can't be swapped; anything else without a content category gets a random one.
export function swapFor(
  current: Spark,
  others: readonly Spark[],
  options: { seen?: ReadonlySet<string>; random?: () => number } = {},
): Spark {
  const random = options.random ?? Math.random
  const category: ContentCategory = (CONTENT_CATEGORIES as readonly string[]).includes(current.category)
    ? (current.category as ContentCategory)
    : pick(CONTENT_CATEGORIES, random)
  const exclude = new Set([current.text, ...others.map((s) => s.text)])
  return sparkFrom(category, options.seen ?? new Set(), random, exclude)
}
