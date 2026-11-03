import { z } from 'zod'

// Bump when the saved JSON shape changes, and add a migration for older boards (see migrate below).
export const BOARD_VERSION = 4

export const MAX_NODE_TEXT = 200
export const MAX_BOARD_NAME = 80
// There's no limit on ideas or notes. This only stops a runaway board from filling browser storage.
export const MAX_NODES = 1000

export const NODE_KINDS = ['spark', 'nudge', 'user'] as const
export const SPARK_CATEGORIES = [
  'theme',
  'words',
  'curiosities',
  'objects',
  'nature',
  'problems',
  'constraints',
] as const
// How each spark category is shown (singular, as in a file path: ~/object).
export const CATEGORY_LABEL: Record<(typeof SPARK_CATEGORIES)[number], string> = {
  theme: 'theme',
  words: 'word',
  curiosities: 'curiosity',
  objects: 'object',
  nature: 'nature',
  problems: 'problem',
  constraints: 'constraint',
}

export const NUDGE_TYPES = [
  'related',
  'opposite',
  'described',
  'perspective',
  'scale',
  'senses',
  'wildcard',
  'push',
] as const

const id = z.string().min(1).max(64)
const coordinate = z.number().finite()

export const boardNodeSchema = z.object({
  // Never shown. Random for new boxes, so two people adding at once can't clash.
  id,
  // What you see on the box and type in commands (/link 3 7). Unique on the board.
  number: z.number().int().positive(),
  text: z.string().trim().min(1).max(MAX_NODE_TEXT),
  kind: z.enum(NODE_KINDS),
  x: coordinate,
  y: coordinate,
  // Sparks only
  category: z.enum(SPARK_CATEGORIES).optional(),
  locked: z.boolean().optional(),
  // Nudges only
  nudgeType: z.enum(NUDGE_TYPES).optional(),
  // Who favourited it. Signed out it's only ever you (ME); on a shared board, everyone's account id.
  favouritedBy: z.array(id).optional(),
})

export const linkSchema = z.object({
  from: id,
  to: id,
})

export const boardSchema = z
  .object({
    version: z.literal(BOARD_VERSION),
    id,
    name: z.string().trim().min(1).max(MAX_BOARD_NAME),
    nodes: z.array(boardNodeSchema).max(MAX_NODES),
    links: z.array(linkSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((board, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path })

    const ids = new Set<string>()
    const numbers = new Set<number>()
    board.nodes.forEach((node, i) => {
      if (ids.has(node.id)) issue(`Duplicate node id "${node.id}"`, ['nodes', i, 'id'])
      ids.add(node.id)
      if (numbers.has(node.number)) issue(`Duplicate number ${node.number}`, ['nodes', i, 'number'])
      numbers.add(node.number)

      if (node.kind === 'spark' && !node.category)
        issue('Sparks need a category', ['nodes', i, 'category'])
      if (node.kind !== 'spark' && node.category !== undefined)
        issue('Only sparks have a category', ['nodes', i, 'category'])
      if (node.kind !== 'spark' && node.locked !== undefined)
        issue('Only sparks can be locked', ['nodes', i, 'locked'])
      if (node.kind === 'nudge' && !node.nudgeType)
        issue('Nudges need a nudgeType', ['nodes', i, 'nudgeType'])
      if (node.kind !== 'nudge' && node.nudgeType !== undefined)
        issue('Only nudges have a nudgeType', ['nodes', i, 'nudgeType'])
    })

    board.nodes.forEach((node, i) => {
      if (node.favouritedBy && new Set(node.favouritedBy).size !== node.favouritedBy.length) issue('Someone favourited this twice', ['nodes', i, 'favouritedBy'])
    })

    // Links are undirected: a→b and b→a count as the same link.
    const seen = new Set<string>()
    board.links.forEach((link, i) => {
      if (!ids.has(link.from)) issue(`Link to unknown node "${link.from}"`, ['links', i, 'from'])
      if (!ids.has(link.to)) issue(`Link to unknown node "${link.to}"`, ['links', i, 'to'])
      if (link.from === link.to) issue('A node cannot link to itself', ['links', i])
      const key = [link.from, link.to].sort().join('|')
      if (seen.has(key)) issue('Duplicate link', ['links', i])
      seen.add(key)
    })
  })

// Signed out, the only person on a board.
export const ME = 'me'
export const isFavourite = (node: Pick<BoardNode, 'favouritedBy'>) => (node.favouritedBy?.length ?? 0) > 0
export const isMine = (node: Pick<BoardNode, 'favouritedBy'>, who = ME) => node.favouritedBy?.includes(who) ?? false

// Boxes are shown and typed as their number (1, 2…), never their id.
export const numberOf = (board: Board, id?: string) => {
  const node = id ? board.nodes.find((n) => n.id === id) : undefined
  // Not on the board: show what was asked for (an older id like n9 shows as 9).
  return node ? String(node.number) : (id ?? '').replace(/^n(\d+)$/, '$1')
}
// "2" (or "n2", as older notes wrote it) means the box numbered 2. Anything else is left as it is,
// so an unknown number still gets a clear "nothing numbered" message.
export const idOf = (board: Board, typed: string) => {
  const m = /^n?(\d+)$/i.exec(typed)
  if (!m) return typed
  return board.nodes.find((n) => n.number === Number(m[1]))?.id ?? typed
}

export type Board = z.infer<typeof boardSchema>
export type BoardNode = z.infer<typeof boardNodeSchema>
export type Link = z.infer<typeof linkSchema>
export type NodeKind = (typeof NODE_KINDS)[number]
export type SparkCategory = (typeof SPARK_CATEGORIES)[number]
export type NudgeType = (typeof NUDGE_TYPES)[number]

export type ParseResult = { ok: true; board: Board } | { ok: false; errors: string[] }

// Older saved boards are brought up to date, one version at a time.
// Version 1 boards had a 3-swap budget and a blank/theme mode. Both went when the limits did.
// Version 2 boards numbered boxes through their ids (n1, n2…). Version 3 keeps those ids (they're
// unique on the board) and adds the number separately; new boxes get random ids.
// Version 3 boards had a yes/no favourite and one "chosen" idea. Version 4 records who favourited
// each box (for shared boards): both become your favourite, so nothing you marked is lost.
function migrate(data: unknown): unknown {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return data
  let board = data as Record<string, unknown>
  if (board.version === 1) {
    const { swapsLeft: _swaps, mode: _mode, ...rest } = board
    board = { ...rest, version: 2 }
  }
  if (board.version === 2 && Array.isArray(board.nodes)) {
    const nodes = board.nodes as Record<string, unknown>[]
    const fromId = (n: Record<string, unknown>) => Number(/^n(\d+)$/.exec(String(n.id))?.[1] ?? 0)
    let next = Math.max(0, ...nodes.map(fromId))
    const used = new Set<number>()
    const numbered = nodes.map((n) => {
      let number = fromId(n)
      if (!number || used.has(number)) number = ++next
      used.add(number)
      return { ...n, number }
    })
    board = { ...board, nodes: numbered, version: 3 }
  }
  if (board.version === 3 && Array.isArray(board.nodes)) {
    const nodes = (board.nodes as Record<string, unknown>[]).map(({ favourite, chosen, ...n }) => (favourite || chosen ? { ...n, favouritedBy: [ME] } : n))
    board = { ...board, nodes, version: 4 }
  }
  return board
}

// Use this for anything that didn't come from our own code: localStorage, imported files.
export function parseBoard(data: unknown): ParseResult {
  const result = boardSchema.safeParse(migrate(data))
  if (result.success) return { ok: true, board: result.data }
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || 'board'}: ${i.message}`),
  }
}
