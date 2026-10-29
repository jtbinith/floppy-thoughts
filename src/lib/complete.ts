import type { Board } from './board'
import { NUDGE_CHOICES } from './nudges/pickNudge'

// Tab completion for the terminal, like a shell: completes as far as it can,
// and lists the options when there's more than one.

export const COMMANDS = [
  'add', 'edit', 'delete', 'rm', 'link', 'unlink', 'nudge', 'swap', 'list',
  'new', 'boards', 'open', 'undo', 'redo', 'clear', 'help',
] as const

// What each argument of a command expects.
type Arg = 'node' | 'own' | 'spark' | 'nudgeType' | 'board' | 'text'
const ARGS: Partial<Record<(typeof COMMANDS)[number], Arg[]>> = {
  edit: ['own', 'text'],
  delete: ['own'],
  rm: ['own'],
  link: ['node', 'node'],
  unlink: ['node', 'node'],
  nudge: ['node', 'nudgeType'],
  swap: ['spark'],
  open: ['board'],
}

export type Completion = { value: string; options: string[] }

const commonPrefix = (words: string[]) =>
  words.reduce((prefix, w) => {
    let i = 0
    while (i < prefix.length && i < w.length && prefix[i] === w[i]) i++
    return prefix.slice(0, i)
  })

function candidates(arg: Arg, board: Board, boardCount: number): string[] {
  switch (arg) {
    case 'node':
      return board.nodes.map((n) => n.id)
    case 'own':
      return board.nodes.filter((n) => n.kind !== 'spark').map((n) => n.id)
    case 'spark':
      return board.nodes.filter((n) => n.kind === 'spark' && !n.locked).map((n) => n.id)
    case 'nudgeType':
      return [...NUDGE_CHOICES]
    case 'board':
      return Array.from({ length: boardCount }, (_, i) => String(i + 1))
    case 'text':
      return []
  }
}

export function complete(input: string, board: Board, boardCount = 0): Completion {
  // Only the last word is completed; everything before it stays as typed.
  const endsWithSpace = /\s$/.test(input)
  const words = input.trimStart().split(/\s+/).filter(Boolean)
  const partial = endsWithSpace ? '' : (words.pop() ?? '')
  const before = input.slice(0, input.length - partial.length)

  let pool: string[]
  if (words.length === 0) pool = [...COMMANDS]
  else {
    const args = ARGS[words[0].toLowerCase() as keyof typeof ARGS]
    const arg = args?.[words.length - 1]
    pool = arg ? candidates(arg, board, boardCount) : []
  }

  const matches = pool.filter((c) => c.startsWith(partial.toLowerCase()))
  if (matches.length === 0) return { value: input, options: [] }
  if (matches.length === 1) return { value: `${before}${matches[0]} `, options: [] }
  // Several matches: complete the shared start, and show the choices.
  return { value: `${before}${commonPrefix(matches)}`, options: matches }
}
