import { CONTENT_CATEGORIES, SPARKS, type ContentCategory } from './content'
import { sparkFrom, type Spark } from './deal'

// The vending machine's rows: one per category, plus "surprise me".
export const VEND_ROWS = [...CONTENT_CATEGORIES, 'surprise'] as const
export type VendRow = (typeof VEND_ROWS)[number]

// A row runs out only once every note in its category is already on the board.
export function rowEmpty(row: VendRow, onBoard: ReadonlySet<string>): boolean {
  if (row === 'surprise') return CONTENT_CATEGORIES.every((c) => rowEmpty(c, onBoard))
  return SPARKS[row].every((t) => onBoard.has(t))
}

// One note from `row`, never one already on the board, preferring ones you haven't seen.
export function vendNote(
  row: VendRow,
  onBoard: ReadonlySet<string>,
  options: { seen?: ReadonlySet<string>; random?: () => number } = {},
): Spark | null {
  const random = options.random ?? Math.random
  if (rowEmpty(row, onBoard)) return null
  const open = CONTENT_CATEGORIES.filter((c) => !rowEmpty(c, onBoard))
  const category: ContentCategory = row === 'surprise' ? open[Math.floor(random() * open.length)] : row
  return sparkFrom(category, options.seen ?? new Set(), random, onBoard)
}
