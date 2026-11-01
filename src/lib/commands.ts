import { MAX_BOARD_NAME, shown, toId, type Board } from './board'
import { addLink, addUserNode, chooseIdea, deleteUserNode, findNode, neighbours, cleanText, editUserNode, removeLink, setMainTheme, toggleFavourite, touch, type OpResult } from './boardOps'

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
// Anything you type is a thought; commands start with "/", like Slack or Discord, so you never
// have to wonder whether a thought will be mistaken for one.
// Ids are the numbers that appear on boxes while you type a command.
export const HELP = [
  'type a thought and press Enter to add it. commands start with /',
  '',
  'IDEAS',
  '  /edit <id> <text>   change one of your ideas, or the theme',
  '  /del <id>           delete anything, with its links',
  '',
  'NOTES AND NUDGES',
  '  /theme <text>       set the main theme, e.g. /theme Time',
  '  /vend [row]         get a shrimp note (rows: words objects problems curiosities nature surprise)',
  '  /nudge <id> [type]  a word or question to push an idea further',
  '                      types: related opposite described perspective scale senses push wildcard',
  '',
  'LINKS',
  '  /link <id> <id>…    link two things, or the first to each of the rest: /link 4 2 5 links 4 to 2 and to 5',
  '  /unlink <id> <id>…  remove links the same way: /unlink 4 2 5 · or just /unlink 4 to clear all of 4\'s links',
  '  /list               everything on this board, and what it\'s linked to',
  '',
  'FAVOURITES AND YOUR IDEA',
  '  /fav <id>           favourite something, or unfavourite it',
  '  /favs               this board\'s favourites',
  '  /favboard           copy this board\'s favourites onto a new board',
  '  /pick <id>          mark the idea you\'re going with, and see how you got there',
  '  /summary            show that summary again',
  '',
  'VIEW',
  '  /fit                fit the whole board on screen',
  '  /tidy               lay the board out neatly (undo puts it back)',
  '',
  'BOARDS',
  '  /new                start a new board',
  '  /boards             list your boards',
  '  /open <n>           open one of them',
  '  /rename <name>      rename this board',
  '',
  'TERMINAL',
  '  /undo, /redo        step back or forward (Ctrl+Z / Ctrl+Shift+Z)',
  '  /clear              clear the terminal',
  '  /help               the commands list, beside the board',
  '',
  'TIPS',
  '  Tab completes commands and ids · ↑ ↓ for previous lines · Ctrl+C cancels the line',
  '  Esc: jump to the board, to act on what you just added (Delete, Tab, N, F)',
  '  / on the board starts a command · Ctrl+` (backtick) jumps back to the terminal',
  '  ids are the numbers that show on boxes while you type a command · Tab finds them by words: /link clo',
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
// What each command's arguments have to look like. Anything else gets its usage line back.
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
  theme: (a) => a.length > 0,
  rename: (a) => a.length > 0,
  edit: (a) => a.length > 1 && ID.test(a[0]),
  del: (a) => a.length === 1 && ID.test(a[0]),
  // Longer names still work, so habits from other tools don't trip you up.
  delete: (a) => a.length === 1 && ID.test(a[0]),
  rm: (a) => a.length === 1 && ID.test(a[0]),
  fav: (a) => a.length === 1 && ID.test(a[0]),
  pick: (a) => a.length === 1 && ID.test(a[0]),
  nudge: (a) => (a.length === 1 || a.length === 2) && ID.test(a[0]),
  link: (a) => a.length >= 2 && a.every((x) => ID.test(x)),
  unlink: (a) => a.length >= 1 && a.every((x) => ID.test(x)),
  vend: (a) => a.length <= 1,
  open: (a) => a.length === 1 && NUMBER.test(a[0]),
}

// A command is any line starting with "/". Everything else is a thought.
export const looksLikeCommand = (input: string) => /^\/\S/.test(input.trim())

// Commands whose arguments are all things on the board, and ones where only the first is.
const ALL_IDS = new Set(['del', 'delete', 'rm', 'fav', 'pick', 'link', 'unlink'])
const FIRST_ID = new Set(['edit', 'nudge'])

// The command's name (without the "/") and its arguments. Ids are typed as plain numbers ("2"),
// so they're turned into the saved form ("n2") here, and nothing else has to care.
export function parseCommand(input: string): { name: string; args: string[]; text: string } {
  const line = input.trim().slice(1)
  const [rawName = '', ...raw] = line.split(/\s+/)
  const name = rawName.toLowerCase()
  const args = raw.map((a, i) => (ALL_IDS.has(name) || (FIRST_ID.has(name) && i === 0) ? toId(a) : a))
  const rest = line.slice(rawName.length).trim()
  // For /edit, the text after the id.
  const text = FIRST_ID.has(name) && raw.length ? `${args[0]} ${rest.slice(raw[0].length).trim()}` : rest
  return { name, args, text }
}

// What's wrong with a command line, if anything: unknown, or the wrong arguments.
export function commandProblem(input: string): string | null {
  const { name, args } = parseCommand(input)
  const shape = SHAPES[name]
  if (!shape) return `there's no /${name} command. type /help for them all`
  if (!shape(args)) return `usage: ${usageOf(name)}`
  return null
}

// The usage line from the help, e.g. "/link <id> <id>…".
function usageOf(name: string): string {
  const line = HELP.find((l) => l.trim().startsWith(`/${name} `) || l.trim() === `/${name}` || l.includes(` /${name} `))
  return line ? line.trim().split(/\s{2,}/)[0] : `/${name}`
}

function fromOp(result: OpResult, success: (r: Extract<OpResult, { ok: true }>) => string): CommandResult {
  return result.ok ? { board: result.board, output: [success(result)] } : fail(result.error)
}

export function runCommand(board: Board, input: string, ctx: CommandContext): CommandResult {
  const line = input.trim()
  if (!line) return { output: [] }
  if (!looksLikeCommand(line)) return fromOp(addUserNode(board, line, ctx.addAt, ctx.now), (r) => `added ${shown(r.node?.id)}: ${r.node?.text}`)
  const problem = commandProblem(line)
  if (problem) return fail(problem)
  const { name, args: rest, text: args } = parseCommand(line)

  switch (name) {
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
              return `  ${shown(n.id).padEnd(3)} ${kind?.padEnd(11)} ${n.favourite ? '♥ ' : ''}${n.text}${links.length ? `  (linked to ${links.map(shown).join(', ')})` : ''}`
            })
          : ['  the board is empty. type a thought, or try /vend'],
      }


    case 'edit': {
      const [id] = rest
      const text = args.slice(id.length).trim()
      return fromOp(editUserNode(board, id, text, ctx.now), (r) => `edited ${shown(r.node?.id)}: ${r.node?.text}`)
    }

    case 'del':
    case 'delete':
    case 'rm': {
      const [id] = rest
      return fromOp(deleteUserNode(board, id, ctx.now), (r) => `deleted ${shown(r.node?.id)}: ${r.node?.text}`)
    }

    case 'theme':
      return fromOp(setMainTheme(board, args, ctx.addAt, ctx.now), (r) => `main theme ${shown(r.node?.id)}: ${r.node?.text}`)

    case 'pick': {
      const [id] = rest
      return fromOp(chooseIdea(board, id, ctx.now), (r) => (r.node?.chosen ? `${shown(id)} is the one: ${r.node.text}` : `${shown(id)} is no longer the one`))
    }

    case 'fav': {
      const [id] = rest
      return fromOp(toggleFavourite(board, id, ctx.now), (r) => `${r.node?.favourite ? '♥ favourited' : 'unfavourited'} ${shown(r.node?.id)}: ${r.node?.text}`)
    }

    case 'rename': {
      const name = cleanText(args).slice(0, MAX_BOARD_NAME)
      if (!name) return fail('usage: /rename <name>')
      return { board: touch({ ...board, name }, ctx.now ?? new Date()), output: [`renamed this board to ${name}`] }
    }

    // `link n4 n2 n5` links n4 to each of the others, as one change.
    case 'link':
    case 'unlink': {
      const [a, ...others] = rest
      // `/unlink 4` on its own: every link to 4 goes, and 4 stays.
      if (name === 'unlink' && others.length === 0) {
        const node = findNode(board, a)
        if (!node) return fail(`Nothing numbered ${shown(a)}`)
        const around = neighbours(board, a)
        if (around.length === 0) return fail(`${shown(a)} isn't linked to anything`)
        return {
          board: touch({ ...board, links: board.links.filter((l) => l.from !== a && l.to !== a) }, ctx.now ?? new Date()),
          output: [`unlinked ${shown(a)} from ${around.length === 1 ? shown(around[0]) : `${around.slice(0, -1).map(shown).join(', ')} and ${shown(around.at(-1))}`}`],
        }
      }
      const linking = name === 'link'
      let next = board
      for (const b of others) {
        const r = linking ? addLink(next, a, b, ctx.now) : removeLink(next, a, b, ctx.now)
        if (!r.ok) return fail(r.error)
        next = r.board
      }
      const names = others.map(shown)
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
      return { board: next, output: [`${linking ? 'linked' : 'unlinked'} ${shown(a)} ${linking ? 'to' : 'from'} ${list}`] }
    }

    default:
      return fail(`/${name} is handled by the board`)
  }
}
