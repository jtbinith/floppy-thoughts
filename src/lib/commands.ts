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

// Grouped so you can find what you're after, under uppercase headings like a CLI's help.
// Ids like n4 are shown on each box.
export const HELP = [
  'just type a thought and press Enter to add it as an idea.',
  '',
  'IDEAS',
  '  edit <id> <text>    change one of your ideas, or the theme',
  '  delete <id>         delete anything, with its links',
  '  add <text>          add a thought that starts with a command word, like "add delete spam"',
  '',
  'NOTES AND NUDGES',
  '  theme <text>        set the main theme, e.g. theme Time',
  '  vend [row]          get a shrimp note (rows: words objects problems curiosities nature surprise)',
  '  nudge <id> [type]   a word or question to push an idea further',
  '                      types: related opposite described perspective scale senses push wildcard',
  '',
  'LINKS',
  '  link <id> <id>…     link two things, or one to several: link n4 n2 n5',
  '  unlink <id> <id>…   remove links the same way',
  '  list                everything on this board, and what it\'s linked to',
  '',
  'FAVOURITES AND YOUR IDEA',
  '  fav <id>            favourite something, or unfavourite it',
  '  favs                this board\'s favourites',
  '  favboard            copy this board\'s favourites onto a new board',
  '  pick <id>           mark the idea you\'re going with, and see how you got there',
  '  summary             show that summary again',
  '',
  'VIEW',
  '  fit                 fit the whole board on screen',
  '  tidy                lay the board out neatly (undo puts it back)',
  '',
  'BOARDS',
  '  new                 start a new board',
  '  boards              list your boards',
  '  open <n>            open one of them',
  '  rename <name>       rename this board',
  '',
  'TERMINAL',
  '  undo / redo         step back or forward (Ctrl+Z / Ctrl+Shift+Z)',
  '  clear               clear the terminal',
  '  help                the commands list, beside the board',
  '',
  'TIPS',
  '  Tab completes commands and ids · ↑ ↓ for previous lines · Ctrl+C cancels the line',
  '  Esc jumps to the board, on what you just added · Ctrl+` comes back here',
  '  on the board: Tab = linked idea · N = nudge · F = favourite · V = machine',
]

const fail = (message: string): CommandResult => ({ output: [message], error: true })

// The help as groups of entries, for the commands tab: each entry is what you type and what it does.
export type HelpEntry = { usage: string; does: string }
export function helpGroups(): { heading: string; entries: HelpEntry[] }[] {
  const groups: { heading: string; entries: HelpEntry[] }[] = []
  for (const line of HELP) {
    if (isHelpHeading(line)) groups.push({ heading: line, entries: [] })
    else if (line.startsWith('  ') && groups.length) {
      const entries = groups.at(-1)!.entries
      const [usage, does] = line.trim().split(/\s{2,}/)
      // Deeply indented lines carry on the entry above (like the list of nudge types).
      if (/^ {6,}/.test(line) && entries.length) entries.at(-1)!.does += ` · ${line.trim()}`
      else entries.push(does === undefined ? { usage: '', does: usage } : { usage, does })
    }
  }
  return groups
}

// Group headings in the help are the uppercase lines, like "LINKS".
export const isHelpHeading = (line: string) => /^[A-Z][A-Z ]+$/.test(line)

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
  tidy: (a) => a.length === 0,
  fit: (a) => a.length === 0,
  add: (a) => a.length > 0,
  theme: (a) => a.length > 0,
  rename: (a) => a.length > 0,
  edit: (a) => a.length > 1 && ID.test(a[0]),
  delete: (a) => a.length === 1 && ID.test(a[0]),
  rm: (a) => a.length === 1 && ID.test(a[0]),
  fav: (a) => a.length === 1 && ID.test(a[0]),
  pick: (a) => a.length === 1 && ID.test(a[0]),
  nudge: (a) => (a.length === 1 || a.length === 2) && ID.test(a[0]),
  link: (a) => a.length >= 2 && a.every((x) => ID.test(x)),
  unlink: (a) => a.length >= 2 && a.every((x) => ID.test(x)),
  vend: (a) => a.length <= 1,
  open: (a) => a.length === 1 && NUMBER.test(a[0]),
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
              const kind = n.kind === 'spark' ? (n.category === 'theme' ? 'main theme' : 'note') : n.kind === 'nudge' ? n.nudgeType : 'idea'
              return `  ${n.id.padEnd(4)} ${kind?.padEnd(11)} ${n.favourite ? '♥ ' : ''}${n.text}${links.length ? `  (linked to ${links.join(', ')})` : ''}`
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

    // `link n4 n2 n5` links n4 to each of the others, as one change.
    case 'link':
    case 'unlink': {
      const [a, ...others] = rest
      const linking = name.toLowerCase() === 'link'
      let next = board
      for (const b of others) {
        const r = linking ? addLink(next, a, b, ctx.now) : removeLink(next, a, b, ctx.now)
        if (!r.ok) return fail(r.error)
        next = r.board
      }
      const list = others.length === 1 ? others[0] : `${others.slice(0, -1).join(', ')} and ${others.at(-1)}`
      return { board: next, output: [`${linking ? 'linked' : 'unlinked'} ${a} ${linking ? 'to' : 'from'} ${list}`] }
    }

    default:
      return fail(`"${name}" is handled by the board. type help`)
  }
}
