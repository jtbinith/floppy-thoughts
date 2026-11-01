import { shown, type Board, type BoardNode } from './board'
import { NUDGE_CHOICES } from './nudges/pickNudge'
import { VEND_ROWS } from './sparks/vend'

// Tab completion for commands (lines starting with "/"), like a shell: completes as far as it
// can, and lists the options when there's more than one. Thoughts are left alone.

export const COMMANDS = [
  'edit', 'del', 'vend', 'theme', 'link', 'unlink', 'nudge', 'fav', 'favs',
  'favboard', 'pick', 'summary', 'tidy', 'fit', 'list', 'rename', 'new', 'boards', 'open', 'undo', 'redo',
  'clear', 'help',
] as const

// What each argument of a command expects.
type Arg = 'node' | 'own' | 'nudgeType' | 'row' | 'board' | 'text'
const ARGS: Partial<Record<(typeof COMMANDS)[number], Arg[]>> = {
  edit: ['own', 'text'],
  del: ['node'],
  fav: ['node'],
  pick: ['node'],
  vend: ['row'],
  link: ['node', 'node', 'node', 'node', 'node', 'node'],
  unlink: ['node', 'node', 'node', 'node', 'node', 'node'],
  nudge: ['node', 'nudgeType'],
  open: ['board'],
}

// `list`: show the options one per line (they're longer, like "2  clocks that grow").
export type Completion = { value: string; options: string[]; list?: boolean }

const commonPrefix = (words: string[]) =>
  words.reduce((prefix, w) => {
    let i = 0
    while (i < prefix.length && i < w.length && prefix[i] === w[i]) i++
    return prefix.slice(0, i)
  })

// Things on the board that fit `partial`: by number ("2") or by words in the text ("clo").
// Returns their numbers, plus a line for each so you can see which is which.
function nodeMatches(nodes: BoardNode[], partial: string): { values: string[]; lines: string[] } {
  const p = partial.toLowerCase().replace(/^n(?=\d)/, '')
  const hits = /^\d*$/.test(p)
    ? nodes.filter((n) => shown(n.id).startsWith(p))
    : nodes.filter((n) => n.text.toLowerCase().split(/[^a-z0-9']+/).some((w) => w.startsWith(p)) || n.text.toLowerCase().includes(p))
  return { values: hits.map((n) => shown(n.id)), lines: hits.map((n) => `${shown(n.id).padStart(3)}  ${n.text}`) }
}

function candidates(arg: Arg, boardCount: number): string[] {
  switch (arg) {
    case 'node':
    case 'own':
      return []
    case 'nudgeType':
      return [...NUDGE_CHOICES]
    case 'row':
      return [...VEND_ROWS]
    case 'board':
      return Array.from({ length: boardCount }, (_, i) => String(i + 1))
    case 'text':
      return []
  }
}

export function complete(input: string, board: Board, boardCount = 0): Completion {
  // Only commands complete; a thought is just text.
  if (!input.trimStart().startsWith('/')) return { value: input, options: [] }
  // Only the last word is completed; everything before it stays as typed.
  const endsWithSpace = /\s$/.test(input)
  const words = input.trimStart().slice(1).split(/\s+/).filter(Boolean)
  const partial = endsWithSpace ? '' : (words.pop() ?? '')
  const before = input.slice(0, input.length - partial.length)

  let pool: string[]
  if (words.length === 0) pool = [...COMMANDS]
  else {
    const args = ARGS[words[0].toLowerCase() as keyof typeof ARGS]
    const arg = args?.[words.length - 1]
    // Ids complete from a number or from words in the thought, filling in its number.
    if (arg === 'node' || arg === 'own') {
      const nodes = arg === 'own' ? board.nodes.filter((n) => n.kind === 'user' || n.category === 'theme') : board.nodes
      const { values, lines } = nodeMatches(nodes, partial)
      if (values.length === 0) return { value: input, options: [] }
      if (values.length === 1) return { value: `${before}${values[0]} `, options: [] }
      return { value: input, options: lines, list: true }
    }
    pool = arg ? candidates(arg, boardCount) : []
  }

  const matches = pool.filter((c) => c.startsWith(partial.toLowerCase()))
  if (matches.length === 0) return { value: input, options: [] }
  if (matches.length === 1) return { value: `${before}${matches[0]} `, options: [] }
  // Several matches: complete the shared start, and show the choices (commands with their /).
  return { value: `${before}${commonPrefix(matches)}`, options: words.length === 0 ? matches.map((m) => `/${m}`) : matches }
}
