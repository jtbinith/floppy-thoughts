import { BOARD_VERSION, SWAP_BUDGET, type Board, type BoardNode } from '../board'
import { cleanText } from '../boardOps'
import type { Spark } from './deal'

// Where the three sparks start: a loose triangle with room between them to think.
const LAYOUT = [
  { x: 0, y: 0 },
  { x: 420, y: 40 },
  { x: 180, y: 280 },
]

export function createBoard(options: {
  sparks: Spark[]
  theme?: string
  name?: string
  now?: Date
  id?: string
}): Board {
  const now = (options.now ?? new Date()).toISOString()
  const theme = options.theme ? cleanText(options.theme) : ''
  const sparks: Spark[] = theme ? [{ text: theme, category: 'theme' }, ...options.sparks] : options.sparks
  const nodes: BoardNode[] = sparks.slice(0, LAYOUT.length).map((spark, i) => ({
    id: `n${i + 1}`,
    text: spark.text,
    kind: 'spark',
    category: spark.category,
    ...(spark.category === 'theme' ? { locked: true } : {}),
    ...LAYOUT[i],
  }))
  return {
    version: BOARD_VERSION,
    id: options.id ?? crypto.randomUUID(),
    name: cleanText(options.name ?? '') || theme || 'untitled board',
    mode: theme ? 'theme' : 'blank',
    swapsLeft: SWAP_BUDGET,
    nodes,
    links: [],
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}
