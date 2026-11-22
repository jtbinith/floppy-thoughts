import type { Board, NudgeType, SparkCategory } from '../board'
import { linksOf, type Relation, type WordLinks } from './words'
import { QUESTIONS, WILDCARDS, fillQuestion, type QuestionType } from './questions'

// Chooses one nudge for an idea. Words come from our own word data (open datasets, see
// nudges/words.ts); questions and most wildcards are hand-written. If there's no word that fits, a
// question is used instead, so there's always a nudge.

export type Nudge = { text: string; type: NudgeType }

// The types a user can ask for.
export const NUDGE_CHOICES = ['related', 'opposite', 'described', 'rhyme', 'perspective', 'scale', 'senses', 'push', 'wildcard'] as const
export type NudgeChoice = (typeof NUDGE_CHOICES)[number]

// How each type reads in the nudge button's menu.
export const NUDGE_LABEL: Record<NudgeChoice, string> = {
  related: 'something related',
  opposite: 'an opposite',
  described: 'how it\'s described',
  rhyme: 'a rhyme or sound-alike',
  perspective: 'someone else\'s view',
  scale: 'bigger or smaller',
  senses: 'how it looks, sounds or feels',
  push: 'push it further',
  wildcard: 'a wildcard',
}

const WORDS: readonly NudgeChoice[] = ['related', 'opposite', 'described', 'rhyme']

const STOPWORDS = new Set(
  'a an the and or but of for to in on at by with from up about into over after my your our their his her its i me we you they it this that these those is are was were be been am do does did have has had not no so if then than too very can could would should will just what who how why when where which while'.split(' '),
)

// The most useful single word to look up: a long word that isn't filler, preferring nouns.
// Words ending -ed/-ing/-ly are usually verbs or adverbs ("recorded"), which make poor lookups.
export function keywordOf(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^a-z' -]/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  if (words.length === 0) return null
  const score = (w: string) => w.length - (/(ed|ing|ly)$/.test(w) ? 6 : 0)
  return words.reduce((best, w) => (score(w) > score(best) ? w : best))
}

// Words that say nothing about the thing itself.
const BLAND = new Set(
  'many most other common popular next nearest same new old first last own few several such various different certain main whole entire little big small good great nice bad fun interesting important useful beautiful pretty lovely cool real normal usual'.split(
    ' ',
  ),
)

const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)]

// Which nudges make sense for a node. A nudge that doesn't fit is just noise.
// Wildcards fit everywhere: a deliberately random leap is part of the point.
const WORD_TYPES: readonly NudgeChoice[] = ['related', 'opposite', 'described', 'rhyme']

const FIT_BY_CATEGORY: Record<SparkCategory, readonly NudgeChoice[]> = {
  theme: ['related', 'rhyme', 'opposite', 'described', 'perspective', 'scale', 'senses', 'wildcard'],
  words: ['related', 'rhyme', 'opposite', 'described', 'perspective', 'scale', 'senses', 'wildcard'],
  objects: ['related', 'rhyme', 'described', 'perspective', 'scale', 'senses', 'wildcard'],
  problems: ['perspective', 'scale', 'push', 'wildcard'],
  curiosities: ['related', 'rhyme', 'perspective', 'scale', 'senses', 'wildcard'],
  nature: ['related', 'rhyme', 'perspective', 'scale', 'senses', 'wildcard'],
  // A limit: push it further, or see it from someone else's side.
  constraints: ['perspective', 'scale', 'push', 'wildcard'],
}

// How many links a node is from the nearest spark (Infinity if it isn't connected to one).
export function distanceFromSpark(board: Board, id: string): number {
  const neighbours = (n: string) => board.links.filter((l) => l.from === n || l.to === n).map((l) => (l.from === n ? l.to : l.from))
  const seen = new Set([id])
  let frontier = [id]
  for (let d = 0; frontier.length; d++) {
    if (frontier.some((n) => board.nodes.find((x) => x.id === n)?.kind === 'spark')) return d
    frontier = frontier.flatMap(neighbours).filter((n) => !seen.has(n) && seen.add(n))
  }
  return Infinity
}

// Word nudges look up one keyword, which only works reliably on short text.
const isShort = (text: string) => text.replace(/["']/g, '').trim().split(/\s+/).length <= 3

export function fittingTypes(board: Board, targetId: string): NudgeChoice[] {
  const target = board.nodes.find((n) => n.id === targetId)
  if (!target || target.kind === 'nudge') return []
  let fit: readonly NudgeChoice[]
  if (target.kind === 'spark') fit = FIT_BY_CATEGORY[target.category ?? 'words']
  else
    fit =
      // Next to a note, or not linked to anything yet: an early idea.
      [0, 1, Infinity].includes(distanceFromSpark(board, targetId))
        ? // An early idea: still exploring.
          ['related', 'opposite', 'rhyme', 'perspective', 'scale', 'senses', 'push', 'wildcard']
        : // A developed idea: push it further rather than play word games.
          ['perspective', 'scale', 'push', 'wildcard']
  return fit.filter((t) => !WORD_TYPES.includes(t) || isShort(target.text))
}

// Picks a fitting type, avoiding types the idea already has a nudge of.
export function chooseType(board: Board, targetId: string, random: () => number = Math.random): NudgeChoice | null {
  const fit = fittingTypes(board, targetId)
  if (!fit.length) return null
  const neighbours = new Set(
    board.links.filter((l) => l.from === targetId || l.to === targetId).map((l) => (l.from === targetId ? l.to : l.from)),
  )
  const used = new Set<string>(board.nodes.filter((n) => n.kind === 'nudge' && neighbours.has(n.id)).map((n) => n.nudgeType ?? ''))
  // A rhyme is saved as a related nudge, so it counts as one here.
  const fresh = fit.filter((t) => !used.has(t === 'rhyme' ? 'related' : t))
  return pick(fresh.length ? fresh : fit, random)
}

function questionNudge(type: QuestionType, subject: string, random: () => number): Nudge {
  return { type, text: fillQuestion(pick(QUESTIONS[type], random), subject) }
}

// What a "related" nudge can say, besides plain associations: what it's for, where it's found,
// what it leads to and needs, what it's like, and sound games (rhymes, words that start the same).
// Associations come up twice as often, as they're the best leaps.
const RELATED_KINDS: readonly Relation[] = [
  'related',
  'related',
  'usedFor',
  'foundAt',
  'parts',
  'kindOf',
  'causes',
  'needs',
  'similar',
  'involves',
  'doneTo',
  'madeOf',
  'rhymes',
  'startsLike',
]

const LABEL: Partial<Record<Relation, (k: string) => string>> = {
  related: (k) => `${k} → makes people think of`,
  opposite: (k) => `opposite of ${k}`,
  described: (k) => `${k}, often described as`,
  usedFor: (k) => `${k}, used for`,
  foundAt: (k) => `${k}, found in or at`,
  parts: (k) => `${k}, has`,
  kindOf: (k) => `${k} is a kind of`,
  causes: (k) => `${k}, leads to`,
  needs: (k) => `${k}, needs`,
  similar: (k) => `${k}, similar to`,
  involves: (k) => `${k}, involves`,
  doneTo: (k) => `${k}, done to`,
  madeOf: (k) => `${k}, made of`,
  rhymes: (k) => `rhymes with ${k}`,
  startsLike: (k) => `starts like ${k}`,
}

const shuffled = <T,>(items: readonly T[], random: () => number): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Words given as nudges lately, so asking again brings something new.
const recent: string[] = []
const remember = (word: string) => {
  recent.push(word)
  if (recent.length > 40) recent.shift()
}

// Our own choosing: from a relation's words (strongest first), skip the bland ones, anything
// already on the board and anything given lately; then pick one of the strongest few at random,
// so it isn't always the same. Further down the list they get strange.
export function chooseWord(words: readonly string[] | undefined, board: Board, random: () => number, top = 5): string | null {
  const onBoard = board.nodes.map((n) => n.text.toLowerCase())
  const fresh = (words ?? []).filter((w) => !BLAND.has(w) && !onBoard.some((t) => t.includes(w)))
  const unseen = fresh.filter((w) => !recent.includes(w))
  const pool = (unseen.length ? unseen : fresh).slice(0, top)
  return pool.length ? pick(pool, random) : null
}

// A word nudge for the idea's key word, or null if our data has nothing that fits.
async function wordNudge(type: NudgeChoice, keyword: string, board: Board, random: () => number, fetchImpl?: typeof fetch): Promise<Nudge | null> {
  const found = await linksOf(keyword, fetchImpl)
  if (!found) return null
  const kinds =
    type === 'related'
      ? RELATED_KINDS.filter((k) => found.links[k]?.length)
      : type === 'rhyme'
        ? (['rhymes', 'startsLike'] as Relation[])
        : [type as Relation]
  // Try the kinds in a random order until one has a fresh word.
  const order = shuffled(kinds, random)
  for (const kind of order) {
    const word = chooseWord(found.links[kind], board, random)
    if (word) {
      remember(word)
      // A rhyme is saved as a related nudge (the board's nudge types don't change).
      return { type: type === 'rhyme' ? 'related' : (type as NudgeType), text: `${LABEL[kind]!(found.word)}: ${word}` }
    }
  }
  return null
}

// A wildcard that's still connected: two steps along associations (clock → time → tide), so it's
// surprising but there's a thread back. Null if there's no such path.
export async function twoStepWildcard(keyword: string, board: Board, random: () => number, fetchImpl?: typeof fetch): Promise<Nudge | null> {
  const first = await linksOf(keyword, fetchImpl)
  const middle = chooseWord(first?.links.related, board, random)
  if (!first || !middle) return null
  const second: WordLinks | undefined = (await linksOf(middle, fetchImpl))?.links
  const near = new Set([first.word, middle, ...(first.links.related ?? [])])
  const far = chooseWord(
    (second?.related ?? []).filter((w) => !near.has(w)),
    board,
    random,
    8,
  )
  if (!far) return null
  remember(far)
  return { type: 'wildcard', text: `wildcard: ${far} (${first.word} → ${middle} → ${far})` }
}

export async function pickNudge(
  board: Board,
  targetId: string,
  options: { type?: NudgeChoice; random?: () => number; fetchImpl?: typeof fetch } = {},
): Promise<Nudge | null> {
  const random = options.random ?? Math.random
  const target = board.nodes.find((n) => n.id === targetId)
  // Nudging a nudge just goes in circles.
  if (!target || target.kind === 'nudge') return null
  const type = options.type ?? chooseType(board, targetId, random)
  if (!type) return null

  if (type === 'wildcard') {
    // Half the time, a connected leap from our word data; otherwise a hand-written wildcard.
    const keyword = keywordOf(target.text)
    if (keyword && random() < 0.5) {
      const leap = await twoStepWildcard(keyword, board, random, options.fetchImpl)
      if (leap) return leap
    }
    const onBoard = new Set(board.nodes.map((n) => n.text.toLowerCase()))
    const choices = WILDCARDS.filter((w) => !onBoard.has(w))
    return { type, text: `wildcard: ${pick(choices.length ? choices : WILDCARDS, random)}` }
  }

  if (WORDS.includes(type)) {
    const keyword = keywordOf(target.text)
    const nudge = keyword ? await wordNudge(type, keyword, board, random, options.fetchImpl) : null
    if (nudge) return nudge
    // No word that fits: fall back to a question that fits, rather than leaving the user stuck.
    const questions = fittingTypes(board, targetId).filter((t): t is QuestionType => t in QUESTIONS)
    return questionNudge(questions.length ? pick(questions, random) : 'push', target.text, random)
  }

  return questionNudge(type as QuestionType, target.text, random)
}
