import type { Board } from './board'
import { addLink, addUserNode, deleteUserNode, editUserNode, removeLink, spaceLeft, type OpResult } from './boardOps'

// The terminal's command language. Pure: takes a board and a line of input,
// returns the new board (if it changed) and lines to print.

export type CommandContext = {
  // Where `add` puts new ideas, usually the middle of the visible board.
  addAt: { x: number; y: number }
  now?: Date
}

export type CommandResult = {
  board?: Board
  output: string[]
  clear?: boolean
  error?: boolean
}

export const HELP = [
  'commands:',
  '  add <text>          add your own idea',
  '  edit <id> <text>    change one of your ideas',
  '  delete <id>         delete one of your ideas (and its links)',
  '  nudge <id> [type]   get a word or question to push that idea (or press N)',
  '                      types: related opposite described perspective scale senses push wildcard',
  '  swap <id>           swap a disk for a new one (3 per board, or press S)',
  '  link <id> <id>      link two nodes',
  '  unlink <id> <id>    remove a link',
  '  list                show everything on the board',
  '  new                 start a new board',
  '  boards / open <n>   list your boards, open one',
  '  undo / redo         step back or forward (also Ctrl+Z / Ctrl+Shift+Z)',
  '  clear               clear the terminal',
  '  help                show this',
  'ids like n4 are shown on each node. tips: Tab completes commands and ids, ↑ ↓ for previous commands',
  'on the board: select an idea, then Tab = linked idea, N = nudge',
]

const fail = (message: string): CommandResult => ({ output: [message], error: true })

function fromOp(result: OpResult, success: (r: Extract<OpResult, { ok: true }>) => string): CommandResult {
  return result.ok ? { board: result.board, output: [success(result)] } : fail(result.error)
}

export function runCommand(board: Board, input: string, ctx: CommandContext): CommandResult {
  const line = input.trim()
  if (!line) return { output: [] }
  const [name, ...rest] = line.split(/\s+/)
  const args = line.slice(name.length).trim()

  switch (name.toLowerCase()) {
    case 'help':
    case '?':
      return { output: HELP }

    case 'clear':
      return { output: [], clear: true }

    case 'list':
      return {
        output: [...board.nodes.map((n) => {
          const links = board.links
            .filter((l) => l.from === n.id || l.to === n.id)
            .map((l) => (l.from === n.id ? l.to : l.from))
          const kind = n.kind === 'spark' ? (n.locked ? 'theme' : 'disk') : n.kind === 'nudge' ? n.nudgeType : 'idea'
          return `  ${n.id.padEnd(4)} ${kind?.padEnd(11)} ${n.text}${links.length ? `  ↔ ${links.join(' ')}` : ''}`
        }), `  ${spaceLeft(board)} spaces left on the board`],
      }

    case 'add':
      if (!args) return fail('usage: add <text>')
      return fromOp(addUserNode(board, args, ctx.addAt, ctx.now), (r) => `added ${r.node?.id}: ${r.node?.text}`)

    case 'edit': {
      const [id] = rest
      const text = args.slice(id?.length ?? 0).trim()
      if (!id || !text) return fail('usage: edit <id> <text>')
      return fromOp(editUserNode(board, id, text, ctx.now), (r) => `edited ${r.node?.id}: ${r.node?.text}`)
    }

    case 'delete':
    case 'rm': {
      const [id] = rest
      if (!id || rest.length > 1) return fail('usage: delete <id>')
      return fromOp(deleteUserNode(board, id, ctx.now), (r) => `deleted ${r.node?.id}: ${r.node?.text}`)
    }

    case 'link':
    case 'unlink': {
      const [a, b] = rest
      if (!a || !b || rest.length > 2) return fail(`usage: ${name.toLowerCase()} <id> <id>`)
      return name.toLowerCase() === 'link'
        ? fromOp(addLink(board, a, b, ctx.now), () => `linked ${a} ↔ ${b}`)
        : fromOp(removeLink(board, a, b, ctx.now), () => `unlinked ${a} ↔ ${b}`)
    }

    default:
      return fail(`unknown command "${name}". type help`)
  }
}
