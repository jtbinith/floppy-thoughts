import { MAX_BOARD_NAME, shown, toId, type Board } from './board'
import { NUDGE_CHOICES } from './nudges/pickNudge'
import { VEND_ROWS } from './sparks/vend'
import { addLink, addUserNode, chooseIdea, cleanText, deleteUserNode, editUserNode, findNode, neighbours, removeLink, setMainTheme, toggleFavourite, touch, type OpResult } from './boardOps'

// The terminal's command language. Anything you type is a thought; commands start with "/",
// like Slack or Discord, so a thought is never mistaken for one.
//
// Every command is one entry in COMMANDS below: its name, what it's for, what its arguments are,
// and what it does. The help, the commands tab, usage errors, argument checks and Tab completion
// are all made from that one list, so adding a command means adding one entry.

export type CommandContext = {
  // Where new ideas go, usually the middle of the visible board.
  addAt: { x: number; y: number }
  now?: Date
  // The screen, for commands that need more than the board (tidy, the machine, popups).
  // Left out in unit tests, where those commands say they need the board.
  ui?: BoardUi
}

// What the board on screen can do for a command.
export type BoardUi = {
  undo: () => string
  redo: () => string
  tidy: () => string
  fit: () => string
  showCommands: () => void
  newBoard: () => void
  // Your boards, newest first, with which one is open.
  boards: () => { name: string; open: boolean }[]
  openBoard: (index: number) => string | null
  // Deleting may stop to ask whether to keep a chain connected.
  remove: (id: string) => string
  showSummary: () => boolean
  favouritesBoard: () => string
  vend: (row: string | undefined) => { text: string; error?: boolean }
  // Nudges come back later (Datamuse is asked), so they print when they arrive.
  nudge: (id: string, type: string | undefined) => void
}

export type CommandResult = {
  board?: Board
  output: string[]
  clear?: boolean
  error?: boolean
  // Something to do on screen once the change is saved, like showing the summary.
  then?: () => void
}

// What a command's arguments are: things on the board, words, or the rest of the line.
export type Arg = 'node' | 'own' | 'nudgeType' | 'row' | 'board' | 'text'
type ArgSpec = { kind: Arg; optional?: boolean; repeats?: boolean }

type Call = { board: Board; args: string[]; text: string; ctx: CommandContext }

type Command = {
  name: string
  aliases?: string[]
  group: Group
  usage: string
  does: string
  // A second line in the help, like the list of nudge types.
  more?: string
  // Listed under another command's line (redo is with undo).
  hidden?: boolean
  args: ArgSpec[]
  run: (call: Call) => CommandResult
}

const GROUPS = ['IDEAS', 'NOTES AND NUDGES', 'LINKS', 'FAVOURITES AND YOUR IDEA', 'VIEW', 'BOARDS', 'TERMINAL'] as const
type Group = (typeof GROUPS)[number]

const NUDGE_TYPES_HELP = NUDGE_CHOICES.join(' ')
const VEND_ROWS_HELP = VEND_ROWS.join(' ')

const fail = (message: string): CommandResult => ({ output: [message], error: true })
const needsBoard = (name: string) => fail(`/${name} needs the board on screen`)
const listOf = (items: string[]) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

function fromOp(result: OpResult, success: (r: Extract<OpResult, { ok: true }>) => string): CommandResult {
  return result.ok ? { board: result.board, output: [success(result)] } : fail(result.error)
}

const node: ArgSpec = { kind: 'node' }
const text: ArgSpec = { kind: 'text' }

export const COMMANDS: Command[] = [
  // IDEAS
  {
    name: 'edit',
    group: 'IDEAS',
    usage: '/edit <id> <text>',
    does: 'change one of your ideas, or the theme',
    args: [{ kind: 'own' }, text],
    run: ({ board, args, text, ctx }) => fromOp(editUserNode(board, args[0], text, ctx.now), (r) => `edited ${shown(r.node?.id)}: ${r.node?.text}`),
  },
  {
    name: 'del',
    // Longer names still work, so habits from other tools don't trip you up.
    aliases: ['delete', 'rm'],
    group: 'IDEAS',
    usage: '/del <id>',
    does: 'delete anything, with its links',
    args: [node],
    run: ({ board, args, ctx }) => {
      if (!findNode(board, args[0])) return fail(`Nothing numbered ${shown(args[0])}`)
      if (ctx.ui) return { output: [ctx.ui.remove(args[0])] }
      return fromOp(deleteUserNode(board, args[0], ctx.now), (r) => `deleted ${shown(r.node?.id)}: ${r.node?.text}`)
    },
  },

  // NOTES AND NUDGES
  {
    name: 'theme',
    group: 'NOTES AND NUDGES',
    usage: '/theme <text>',
    does: 'set the main theme, e.g. /theme Time',
    args: [text],
    run: ({ board, text, ctx }) => fromOp(setMainTheme(board, text, ctx.addAt, ctx.now), (r) => `main theme ${shown(r.node?.id)}: ${r.node?.text}`),
  },
  {
    name: 'vend',
    group: 'NOTES AND NUDGES',
    usage: '/vend [row]',
    does: `get a shrimp note (rows: ${VEND_ROWS_HELP})`,
    args: [{ kind: 'row', optional: true }],
    run: ({ args, ctx }) => {
      if (!ctx.ui) return needsBoard('vend')
      const r = ctx.ui.vend(args[0]?.toLowerCase())
      return { output: [r.text], error: r.error }
    },
  },
  {
    name: 'nudge',
    group: 'NOTES AND NUDGES',
    usage: '/nudge <id> [type]',
    does: 'a word or question to push an idea further',
    more: `types: ${NUDGE_TYPES_HELP}`,
    args: [node, { kind: 'nudgeType', optional: true }],
    run: ({ board, args, ctx }) => {
      if (!ctx.ui) return needsBoard('nudge')
      if (!findNode(board, args[0])) return fail(`Nothing numbered ${shown(args[0])}`)
      const type = args[1]?.toLowerCase()
      if (type && !(NUDGE_CHOICES as readonly string[]).includes(type)) return fail(`there's no "${type}" nudge. try: ${NUDGE_TYPES_HELP}`)
      ctx.ui.nudge(args[0], type)
      return { output: [`nudging ${shown(args[0])}…`] }
    },
  },

  // LINKS
  {
    name: 'link',
    group: 'LINKS',
    usage: '/link <id> <id>…',
    does: 'link two things, or the first to each of the rest: /link 4 2 5 links 4 to 2 and to 5',
    args: [node, node, { kind: 'node', optional: true, repeats: true }],
    run: ({ board, args, ctx }) => {
      const [a, ...others] = args
      let next = board
      for (const b of others) {
        const r = addLink(next, a, b, ctx.now)
        if (!r.ok) return fail(r.error)
        next = r.board
      }
      return { board: next, output: [`linked ${shown(a)} to ${listOf(others.map(shown))}`] }
    },
  },
  {
    name: 'unlink',
    group: 'LINKS',
    usage: '/unlink <id> <id>…',
    does: "remove links the same way: /unlink 4 2 5 · or just /unlink 4 to clear all of 4's links",
    args: [node, { kind: 'node', optional: true, repeats: true }],
    run: ({ board, args, ctx }) => {
      const [a, ...others] = args
      // `/unlink 4` on its own: every link to 4 goes, and 4 stays.
      if (others.length === 0) {
        if (!findNode(board, a)) return fail(`Nothing numbered ${shown(a)}`)
        const around = neighbours(board, a)
        if (around.length === 0) return fail(`${shown(a)} isn't linked to anything`)
        const links = board.links.filter((l) => l.from !== a && l.to !== a)
        return { board: touch({ ...board, links }, ctx.now ?? new Date()), output: [`unlinked ${shown(a)} from ${listOf(around.map(shown))}`] }
      }
      let next = board
      for (const b of others) {
        const r = removeLink(next, a, b, ctx.now)
        if (!r.ok) return fail(r.error)
        next = r.board
      }
      return { board: next, output: [`unlinked ${shown(a)} from ${listOf(others.map(shown))}`] }
    },
  },
  {
    name: 'list',
    group: 'LINKS',
    usage: '/list',
    does: "everything on this board, and what it's linked to",
    args: [],
    run: ({ board }) => ({
      output: board.nodes.length
        ? board.nodes.map((n) => {
            const links = neighbours(board, n.id)
            const kind = n.kind === 'spark' ? (n.category === 'theme' ? 'main theme' : 'note') : n.kind === 'nudge' ? n.nudgeType : 'idea'
            return `  ${shown(n.id).padEnd(3)} ${kind?.padEnd(11)} ${n.favourite ? '♥ ' : ''}${n.text}${links.length ? `  (linked to ${links.map(shown).join(', ')})` : ''}`
          })
        : ['  the board is empty. type a thought, or try /vend'],
    }),
  },

  // FAVOURITES AND YOUR IDEA
  {
    name: 'fav',
    group: 'FAVOURITES AND YOUR IDEA',
    usage: '/fav <id>',
    does: 'favourite something, or unfavourite it',
    args: [node],
    run: ({ board, args, ctx }) =>
      fromOp(toggleFavourite(board, args[0], ctx.now), (r) => `${r.node?.favourite ? '♥ favourited' : 'unfavourited'} ${shown(r.node?.id)}: ${r.node?.text}`),
  },
  {
    name: 'favs',
    group: 'FAVOURITES AND YOUR IDEA',
    usage: '/favs',
    does: "this board's favourites",
    args: [],
    run: ({ board }) => {
      const mine = board.nodes.filter((n) => n.favourite)
      return { output: mine.length ? mine.map((n) => `  ♥ ${shown(n.id).padEnd(3)} ${n.text}`) : ['no favourites on this board yet. try /fav <id>'] }
    },
  },
  {
    name: 'favboard',
    group: 'FAVOURITES AND YOUR IDEA',
    usage: '/favboard',
    does: "copy this board's favourites onto a new board",
    args: [],
    run: ({ ctx }) => (ctx.ui ? { output: [ctx.ui.favouritesBoard()] } : needsBoard('favboard')),
  },
  {
    name: 'pick',
    group: 'FAVOURITES AND YOUR IDEA',
    usage: '/pick <id>',
    does: "mark the idea you're going with, and see how you got there",
    args: [node],
    run: ({ board, args, ctx }) => {
      const result = chooseIdea(board, args[0], ctx.now)
      if (!result.ok) return fail(result.error)
      const chosen = !!result.node?.chosen
      return {
        board: result.board,
        output: [chosen ? `${shown(args[0])} is the one: ${result.node?.text}` : `${shown(args[0])} is no longer the one`],
        then: chosen ? () => void ctx.ui?.showSummary() : undefined,
      }
    },
  },
  {
    name: 'summary',
    group: 'FAVOURITES AND YOUR IDEA',
    usage: '/summary',
    does: 'show that summary again',
    args: [],
    run: ({ board, ctx }) => {
      if (!board.nodes.some((n) => n.chosen)) return fail('no idea picked yet. try /pick <id>')
      if (!ctx.ui) return needsBoard('summary')
      ctx.ui.showSummary()
      return { output: ['showing your summary'] }
    },
  },

  // VIEW
  {
    name: 'fit',
    group: 'VIEW',
    usage: '/fit',
    does: 'fit the whole board on screen',
    args: [],
    run: ({ ctx }) => (ctx.ui ? { output: [ctx.ui.fit()] } : needsBoard('fit')),
  },
  {
    name: 'tidy',
    group: 'VIEW',
    usage: '/tidy',
    does: 'lay the board out neatly (undo puts it back)',
    args: [],
    run: ({ ctx }) => (ctx.ui ? { output: [ctx.ui.tidy()] } : needsBoard('tidy')),
  },

  // BOARDS
  {
    name: 'new',
    group: 'BOARDS',
    usage: '/new',
    does: 'start a new board',
    args: [],
    run: ({ ctx }) => {
      if (!ctx.ui) return needsBoard('new')
      ctx.ui.newBoard()
      return { output: ['opening a new board…'] }
    },
  },
  {
    name: 'boards',
    group: 'BOARDS',
    usage: '/boards',
    does: 'list your boards',
    args: [],
    run: ({ ctx }) => {
      if (!ctx.ui) return needsBoard('boards')
      const lines = ctx.ui.boards().map((b, i) => `  ${String(i + 1).padStart(2)}  ${b.name}${b.open ? '  ← open' : ''}`)
      return { output: [...lines, 'open one with: /open <number>'] }
    },
  },
  {
    name: 'open',
    group: 'BOARDS',
    usage: '/open <n>',
    does: 'open one of them',
    args: [{ kind: 'board' }],
    run: ({ args, ctx }) => {
      if (!ctx.ui) return needsBoard('open')
      const opened = ctx.ui.openBoard(Number(args[0]))
      return opened ? { output: [`opening ${opened}…`] } : fail('no board with that number. see: /boards')
    },
  },
  {
    name: 'rename',
    group: 'BOARDS',
    usage: '/rename <name>',
    does: 'rename this board',
    args: [text],
    run: ({ board, text, ctx }) => {
      const name = cleanText(text).slice(0, MAX_BOARD_NAME)
      return { board: touch({ ...board, name }, ctx.now ?? new Date()), output: [`renamed this board to ${name}`] }
    },
  },

  // TERMINAL
  {
    name: 'undo',
    group: 'TERMINAL',
    usage: '/undo, /redo',
    does: 'step back or forward (Ctrl+Z / Ctrl+Shift+Z)',
    args: [],
    run: ({ ctx }) => (ctx.ui ? { output: [ctx.ui.undo()] } : needsBoard('undo')),
  },
  {
    name: 'redo',
    group: 'TERMINAL',
    usage: '/redo',
    does: 'step forward',
    hidden: true,
    args: [],
    run: ({ ctx }) => (ctx.ui ? { output: [ctx.ui.redo()] } : needsBoard('redo')),
  },
  {
    name: 'clear',
    group: 'TERMINAL',
    usage: '/clear',
    does: 'clear the terminal',
    args: [],
    run: () => ({ output: [], clear: true }),
  },
  {
    name: 'help',
    aliases: ['?'],
    group: 'TERMINAL',
    usage: '/help',
    does: 'the commands list, beside the board',
    args: [],
    run: ({ ctx }) => {
      if (!ctx.ui) return { output: HELP }
      ctx.ui.showCommands()
      return { output: ['the commands are open on the right'] }
    },
  },
]

const TIPS = [
  'Tab completes commands and ids · ↑ ↓ for previous lines · Ctrl+C cancels the line',
  'Esc: jump to the board, to act on what you just added (Delete, Tab, N, F)',
  '/ on the board starts a command · Ctrl+` (backtick) jumps back to the terminal',
  'ids are the numbers that show on boxes while you type a command · Tab finds them by words: /link clo',
  'on the board: Tab = linked idea · N = nudge · F = favourite · V = machine',
]

// Looks a command up by its name or an alias.
const byName = new Map(COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => [n, c] as const)))
export const findCommand = (name: string) => byName.get(name.toLowerCase())

// What each command's arguments are, for Tab completion.
export const argKinds = (name: string, position: number): Arg | undefined => {
  const args = findCommand(name)?.args ?? []
  const last = args.at(-1)
  return position < args.length ? args[position].kind : last?.repeats ? last.kind : undefined
}

// ---------- The help, made from the commands ----------

export type HelpEntry = { usage: string; does: string }

// Groups of entries, for the commands tab and the help. TIPS last.
export function helpGroups(): { heading: string; entries: HelpEntry[] }[] {
  const groups = GROUPS.map((heading) => ({
    heading,
    entries: COMMANDS.filter((c) => c.group === heading && !c.hidden).map((c) => ({ usage: c.usage, does: c.more ? `${c.does} · ${c.more}` : c.does })),
  }))
  return [...groups, { heading: 'TIPS', entries: TIPS.map((does) => ({ usage: '', does })) }]
}

// The same, as lines for the terminal.
export const HELP: string[] = [
  'type a thought and press Enter to add it. commands start with /',
  ...GROUPS.flatMap((heading) => [
    '',
    heading,
    ...COMMANDS.filter((c) => c.group === heading && !c.hidden).flatMap((c) => [
      `  ${c.usage.padEnd(Math.max(20, c.usage.length + 2))}${c.does}`,
      ...(c.more ? [`${' '.repeat(22)}${c.more}`] : []),
    ]),
  ]),
  '',
  'TIPS',
  ...TIPS.map((t) => `  ${t}`),
]

// Group headings in the help are the uppercase lines, like "LINKS".
export const isHelpHeading = (line: string) => /^[A-Z][A-Z ]+$/.test(line)

// ---------- Reading a line ----------

// A command is any line starting with "/". Everything else is a thought.
export const looksLikeCommand = (input: string) => /^\/\S/.test(input.trim())

const ID = /^n\d+$/
const NUMBER = /^\d+$/

// Does one typed argument fit what the command expects there?
function fits(kind: Arg, value: string): boolean {
  if (kind === 'node' || kind === 'own') return ID.test(value)
  if (kind === 'board') return NUMBER.test(value)
  return true
}

// Splits a command line into the command, its arguments and any free text. Ids are typed as
// plain numbers ("2"), so they're turned into the saved form ("n2") here, and nothing else has to.
function read(input: string, command: Command): { args: string[]; text: string } | null {
  const line = input.trim().slice(1)
  const raw = line.split(/\s+/).slice(1)
  const specs = command.args
  const textAt = specs.findIndex((s) => s.kind === 'text')
  const args: string[] = []
  const words = textAt === -1 ? raw : raw.slice(0, textAt)
  words.forEach((word, i) => {
    const kind = i < specs.length ? specs[i].kind : specs.at(-1)?.repeats ? specs.at(-1)!.kind : undefined
    args.push(kind === 'node' || kind === 'own' ? toId(word) : word)
  })
  const text = textAt === -1 ? '' : raw.slice(textAt).join(' ').trim()

  // Check the shape: enough arguments, not too many, each the right kind.
  const required = specs.filter((s) => !s.optional && s.kind !== 'text').length
  const repeats = !!specs.at(-1)?.repeats
  const maxWords = textAt === -1 ? (repeats ? Infinity : specs.length) : textAt
  if (args.length < Math.min(required, maxWords) || args.length > maxWords) return null
  if (args.some((a, i) => !fits(i < specs.length ? specs[i].kind : specs.at(-1)!.kind, a))) return null
  if (textAt !== -1 && !text) return null
  return { args, text }
}

export function runCommand(board: Board, input: string, ctx: CommandContext): CommandResult {
  const line = input.trim()
  if (!line) return { output: [] }
  if (!looksLikeCommand(line)) return fromOp(addUserNode(board, line, ctx.addAt, ctx.now), (r) => `added ${shown(r.node?.id)}: ${r.node?.text}`)
  const name = line.slice(1).split(/\s+/)[0]
  const command = findCommand(name)
  if (!command) return fail(`there's no /${name.toLowerCase()} command. type /help for them all`)
  const parsed = read(line, command)
  if (!parsed) return fail(`usage: ${command.usage.split(', ')[0]}`)
  return command.run({ board, ...parsed, ctx })
}
