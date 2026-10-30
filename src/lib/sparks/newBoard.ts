import { BOARD_VERSION, type Board, type BoardNode } from '../board'
import { cleanText } from '../boardOps'
import type { Spark } from './deal'

// Where the starting notes go: a loose triangle for the first three, then further out
// around it, with room between them to think.
export function startingSpot(i: number): { x: number; y: number } {
  const TRIANGLE = [
    { x: 0, y: 0 },
    { x: 420, y: 40 },
    { x: 180, y: 280 },
  ]
  if (i < TRIANGLE.length) return TRIANGLE[i]
  const angle = (i - TRIANGLE.length) * 2.4
  const radius = 480 + (i - TRIANGLE.length) * 30
  return { x: Math.round(180 + Math.cos(angle) * radius), y: Math.round(110 + Math.sin(angle) * radius * 0.7) }
}

export function createBoard(options: { sparks: Spark[]; name?: string; now?: Date; id?: string }): Board {
  const now = (options.now ?? new Date()).toISOString()
  const nodes: BoardNode[] = options.sparks.map((spark, i) => ({
    id: `n${i + 1}`,
    text: spark.text,
    kind: 'spark',
    category: spark.category,
    ...(spark.category === 'theme' ? { locked: true } : {}),
    ...startingSpot(i),
  }))
  return {
    version: BOARD_VERSION,
    id: options.id ?? crypto.randomUUID(),
    name: cleanText(options.name ?? '') || 'untitled board',
    nodes,
    links: [],
    createdAt: now,
    updatedAt: now,
  }
}
