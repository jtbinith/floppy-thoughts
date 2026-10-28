import type { Board, NudgeType } from '../board'
import { fetchWords, type DatamuseRelation } from './datamuse'
import { QUESTIONS, WILDCARDS, fillQuestion, type QuestionType } from './questions'

// Chooses one nudge for an idea. Words come from Datamuse; questions and wildcards
// are hand-written. If Datamuse has nothing (or we're offline), a question is used instead.

export type Nudge = { text: string; type: NudgeType }

// The types a user can ask for. 'news' needs a headline source and comes later.
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

// Avoid giving the same kind of nudge twice in a row on the same idea.
export function chooseType(board: Board, targetId: string, random: () => number = Math.random): NudgeChoice {
  const neighbours = new Set(
    board.links.filter((l) => l.from === targetId || l.to === targetId).map((l) => (l.from === targetId ? l.to : l.from)),
  )
  const used = new Set(board.nodes.filter((n) => n.kind === 'nudge' && neighbours.has(n.id)).map((n) => n.nudgeType))
  const fresh = NUDGE_CHOICES.filter((t) => !used.has(t))
  return pick(fresh.length ? fresh : NUDGE_CHOICES, random)
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
  if (!target) return null
  const type = options.type ?? chooseType(board, targetId, random)

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
    // Nothing useful from Datamuse: fall back to a push question rather than leaving the user stuck.
    return questionNudge('push', target.text, random)
  }

  return questionNudge(type as QuestionType, target.text, random)
}
