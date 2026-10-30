import { MAX_BOARD_NAME, type Board } from './board'
import { addLink, addUserNode, chooseIdea, deleteUserNode, cleanText, editUserNode, removeLink, setMainTheme, toggleFavourite, touch, type OpResult } from './boardOps'

// The terminal's command language. Pure: takes a board and a line of input,
// returns the new board (if it changed) and lines to print.
// Anything that isn't clearly a command is added as an idea, so you can just type your thoughts.

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
  'just type a thought and press Enter to add it as an idea. commands:',
  '  edit <id> <text>    change one of your ideas, or the theme',
  '  delete <id>         delete anything (and its links)',
  '  vend [row]          get a shrimp note from the machine (or press V)',
  '                      rows: words objects problems curiosities nature surprise',
  '  theme <text>        set the main theme, e.g. theme Time',
  '  nudge <id> [type]   get a word or question to push that idea (or press N)',
  '                      types: related opposite described perspective scale senses push wildcard',
  '  swap <id>           swap a note for another from the same row (or press S)',
  '  fav <id>            favourite something, or unfavourite it (or press F)',
  '  favs                list your favourites from every board',
  '  favboard            copy this board\'s favourites onto a new board',
  '  pick <id>           mark the idea you\'re going with, and see how you got there',
  '  summary             show that again',
  '  link <id> <id>      link two nodes',
  '  unlink <id> <id>    remove a link',
  '  list                show everything on the board',
  '  rename <name>       rename this board',
  '  new                 start a new board',
  '  starting <n>        how many notes new boards start with (0 or more)',
  '  boards / open <n>   list your boards, open one',
  '  add <text>          add an idea that starts with a command word',
  '  undo / redo         step back or forward (also Ctrl+Z / Ctrl+Shift+Z)',
  '  clear               clear the terminal',
  '  help                show this',
  'ids like n4 are shown on each node. tips: Tab completes commands and ids, ↑ ↓ for previous commands',
  'on the board: select something, then Tab = linked idea, N = nudge, F = favourite',
]

const fail = (message: string): CommandResult => ({ output: [message], error: true })

const ID = /^n\d+$/
const NUMBER = /^\d+$/
// What a line has to look like to count as each command. Anything else is a thought.
const SHAPES: Record<string, (args: string[]) => boolean> = {
  help: (a) => a.length === 0,
  '?': (a) => a.length === 0,
  list: (a) => a.length === 0,
  clear: (a) => a.length === 0,
  undo: (a) => a.length === 0,
  redo: (a) => a.length === 0,
  new: (a) => a.length === 0,
  boards: (a) => a.length === 0,
  favs: (a) => a.length === 0,
  favboard: (a) => a.length === 0,
  summary: (a) => a.length === 0,
  add: (a) => a.length > 0,
  theme: (a) => a.length > 0,
  rename: (a) => a.length > 0,
  edit: (a) => a.length > 1 && ID.test(a[0]),
  delete: (a) => a.length === 1 && ID.test(a[0]),
  rm: (a) => a.length === 1 && ID.test(a[0]),
  fav: (a) => a.length === 1 && ID.test(a[0]),
  swap: (a) => a.length === 1 && ID.test(a[0]),
  pick: (a) => a.length === 1 && ID.test(a[0]),
  nudge: (a) => (a.length === 1 || a.length === 2) && ID.test(a[0]),
  link: (a) => a.length === 2 && ID.test(a[0]) && ID.test(a[1]),
  unlink: (a) => a.length === 2 && ID.test(a[0]) && ID.test(a[1]),
  vend: (a) => a.length <= 1,
  open: (a) => a.length === 1 && NUMBER.test(a[0]),
  starting: (a) => a.length === 1 && NUMBER.test(a[0]),
}

// Is this line a command? "help" is; "help my nan with video calls" is a thought.
export function looksLikeCommand(input: string): boolean {
  const [name, ...args] = input.trim().split(/\s+/)
  const shape = SHAPES[name?.toLowerCase() ?? '']
  return !!shape && shape(args)
}

function fromOp(result: OpResult, success: (r: Extract<OpResult, { ok: true }>) => string): CommandResult {
  return result.ok ? { board: result.board, output: [success(result)] } : fail(result.error)
}

export function runCommand(board: Board, input: string, ctx: CommandContext): CommandResult {
  const line = input.trim()
  if (!line) return { output: [] }
  if (!looksLikeCommand(line)) return fromOp(addUserNode(board, line, ctx.addAt, ctx.now), (r) => `added ${r.node?.id}: ${r.node?.text}`)
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
        output: board.nodes.length
          ? board.nodes.map((n) => {
              const links = board.links
                .filter((l) => l.from === n.id || l.to === n.id)
                .map((l) => (l.from === n.id ? l.to : l.from))
              const kind = n.kind === 'spark' ? (n.locked ? 'theme' : 'note') : n.kind === 'nudge' ? n.nudgeType : 'idea'
              return `  ${n.id.padEnd(4)} ${kind?.padEnd(11)} ${n.favourite ? '♥ ' : ''}${n.text}${links.length ? `  ↔ ${links.join(' ')}` : ''}`
            })
          : ['  the board is empty. type a thought, or try: vend'],
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
      return fromOp(deleteUserNode(board, id, ctx.now), (r) => `deleted ${r.node?.id}: ${r.node?.text}`)
    }

    case 'theme':
      return fromOp(setMainTheme(board, args, ctx.addAt, ctx.now), (r) => `main theme ${r.node?.id}: ${r.node?.text}`)

    case 'pick': {
      const [id] = rest
      return fromOp(chooseIdea(board, id, ctx.now), (r) => (r.node?.chosen ? `${id} is the one: ${r.node.text}` : `${id} is no longer the one`))
    }

    case 'fav': {
      const [id] = rest
      if (!id || rest.length > 1) return fail('usage: fav <id>')
      return fromOp(toggleFavourite(board, id, ctx.now), (r) => `${r.node?.favourite ? '♥ favourited' : 'unfavourited'} ${r.node?.id}: ${r.node?.text}`)
    }

    case 'rename': {
      const name = cleanText(args).slice(0, MAX_BOARD_NAME)
      if (!name) return fail('usage: rename <name>')
      return { board: touch({ ...board, name }, ctx.now ?? new Date()), output: [`renamed this board to ${name}`] }
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
      return fail(`"${name}" is handled by the board. type help`)
  }
}
