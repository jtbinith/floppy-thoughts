import type { Board, NudgeType, SparkCategory } from '../board'
import { fetchWords, type DatamuseRelation } from './datamuse'
import { QUESTIONS, WILDCARDS, fillQuestion, type QuestionType } from './questions'

// Chooses one nudge for an idea. Words come from Datamuse; questions and wildcards
// are hand-written. If Datamuse has nothing (or we're offline), a question is used instead.

export type Nudge = { text: string; type: NudgeType }

// The types a user can ask for.
export const NUDGE_CHOICES = ['related', 'opposite', 'described', 'perspective', 'scale', 'senses', 'push', 'wildcard'] as const
export type NudgeChoice = (typeof NUDGE_CHOICES)[number]

const DATAMUSE: readonly NudgeChoice[] = ['related', 'opposite', 'described']

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

// Adjectives Datamuse often returns that say nothing about the thing itself.
const BLAND = new Set('many most other common popular next nearest same new old first last own few several such various different certain main whole entire little big small good great'.split(' '))

const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)]

// Which nudges make sense for a node. A nudge that doesn't fit is just noise.
// Wildcards fit everywhere: a deliberately random leap is part of the point.
const WORD_TYPES: readonly NudgeChoice[] = ['related', 'opposite', 'described']

const FIT_BY_CATEGORY: Record<SparkCategory, readonly NudgeChoice[]> = {
  theme: ['related', 'opposite', 'described', 'perspective', 'scale', 'senses', 'wildcard'],
  words: ['related', 'opposite', 'described', 'perspective', 'scale', 'senses', 'wildcard'],
  objects: ['related', 'described', 'perspective', 'scale', 'senses', 'wildcard'],
  problems: ['perspective', 'scale', 'push', 'wildcard'],
  curiosities: ['related', 'perspective', 'scale', 'senses', 'wildcard'],
  nature: ['related', 'perspective', 'scale', 'senses', 'wildcard'],
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
      distanceFromSpark(board, targetId) <= 1
        ? // An early idea: still exploring.
          ['related', 'opposite', 'perspective', 'scale', 'senses', 'push', 'wildcard']
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
  const used = new Set(board.nodes.filter((n) => n.kind === 'nudge' && neighbours.has(n.id)).map((n) => n.nudgeType))
  const fresh = fit.filter((t) => !used.has(t))
  return pick(fresh.length ? fresh : fit, random)
}

function questionNudge(type: QuestionType, subject: string, random: () => number): Nudge {
  return { type, text: fillQuestion(pick(QUESTIONS[type], random), subject) }
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
    const onBoard = new Set(board.nodes.map((n) => n.text.toLowerCase()))
    const choices = WILDCARDS.filter((w) => !onBoard.has(w))
    return { type, text: `wildcard: ${pick(choices.length ? choices : WILDCARDS, random)}` }
  }

  if (DATAMUSE.includes(type)) {
    const keyword = keywordOf(target.text)
    if (keyword) {
      const onBoard = board.nodes.map((n) => n.text.toLowerCase())
      const words = (await fetchWords(type as DatamuseRelation, keyword, options.fetchImpl))
        .filter((w) => !BLAND.has(w) && !onBoard.some((text) => text.includes(w)))
        // The strongest few associations; further down the list they get strange.
        .slice(0, 5)
      if (words.length) {
        const word = pick(words, random)
        const label = { related: `${keyword} → makes people think of`, opposite: `opposite of ${keyword}`, described: `${keyword}, often described as` }[
          type as DatamuseRelation
        ]
        return { type, text: `${label}: ${word}` }
      }
    }
    // Nothing useful from Datamuse: fall back to a question that fits, rather than leaving the user stuck.
    const questions = fittingTypes(board, targetId).filter((t): t is QuestionType => t in QUESTIONS)
    return questionNudge(questions.length ? pick(questions, random) : 'push', target.text, random)
  }

  return questionNudge(type as QuestionType, target.text, random)
}
