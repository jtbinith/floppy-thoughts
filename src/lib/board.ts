import { z } from 'zod'

// Bump when the saved JSON shape changes, and add a migration for older boards.
export const BOARD_VERSION = 1

export const SWAP_BUDGET = 3
export const SPARKS_PER_BOARD = 3
export const MAX_NODE_TEXT = 200
export const MAX_BOARD_NAME = 80
// How many nodes fit on a board. A full board is the cue to stop exploring.
export const BOARD_CAPACITY = 20
// Hard safety cap for imported or corrupted data, well above the capacity so old boards still load.
export const MAX_NODES = 500

export const NODE_KINDS = ['spark', 'nudge', 'user'] as const
export const SPARK_CATEGORIES = [
  'theme',
  'words',
  'headlines',
  'curiosities',
  'objects',
  'nature',
  'problems',
] as const
// How each spark category is shown (singular, as in a file path: ~/object).
export const CATEGORY_LABEL: Record<(typeof SPARK_CATEGORIES)[number], string> = {
  theme: 'theme',
  words: 'word',
  headlines: 'headline',
  curiosities: 'curiosity',
  objects: 'object',
  nature: 'nature',
  problems: 'problem',
}

export const NUDGE_TYPES = [
  'related',
  'opposite',
  'described',
  'perspective',
  'scale',
  'senses',
  'news',
  'wildcard',
  'push',
] as const

const id = z.string().min(1).max(64)
const coordinate = z.number().finite()

export const boardNodeSchema = z.object({
  id,
  text: z.string().trim().min(1).max(MAX_NODE_TEXT),
  kind: z.enum(NODE_KINDS),
  x: coordinate,
  y: coordinate,
  // Sparks only
  category: z.enum(SPARK_CATEGORIES).optional(),
  locked: z.boolean().optional(),
  // Nudges only
  nudgeType: z.enum(NUDGE_TYPES).optional(),
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
    mode: z.enum(['blank', 'theme']),
    swapsLeft: z.number().int().min(0).max(SWAP_BUDGET),
    nodes: z.array(boardNodeSchema).max(MAX_NODES),
    links: z.array(linkSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((board, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path })

    const ids = new Set<string>()
    board.nodes.forEach((node, i) => {
      if (ids.has(node.id)) issue(`Duplicate node id "${node.id}"`, ['nodes', i, 'id'])
      ids.add(node.id)

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

    const sparks = board.nodes.filter((n) => n.kind === 'spark')
    if (sparks.length > SPARKS_PER_BOARD)
      issue(`A board has at most ${SPARKS_PER_BOARD} sparks`, ['nodes'])

    // Theme mode: exactly one locked theme spark. Blank mode: no theme spark.
    const themeSparks = sparks.filter((n) => n.category === 'theme')
    if (board.mode === 'theme') {
      if (themeSparks.length !== 1 || !themeSparks[0].locked)
        issue('Theme boards need exactly one locked theme spark', ['nodes'])
    } else if (themeSparks.length > 0) {
      issue('Blank boards have no theme spark', ['nodes'])
    }

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

export type Board = z.infer<typeof boardSchema>
export type BoardNode = z.infer<typeof boardNodeSchema>
export type Link = z.infer<typeof linkSchema>
export type NodeKind = (typeof NODE_KINDS)[number]
export type SparkCategory = (typeof SPARK_CATEGORIES)[number]
export type NudgeType = (typeof NUDGE_TYPES)[number]

export type ParseResult = { ok: true; board: Board } | { ok: false; errors: string[] }

// Use this for anything that didn't come from our own code: localStorage, imported files.
export function parseBoard(data: unknown): ParseResult {
  const result = boardSchema.safeParse(data)
  if (result.success) return { ok: true, board: result.data }
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || 'board'}: ${i.message}`),
  }
}
