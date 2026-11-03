import { CATEGORY_LABEL, type Board, type BoardNode } from './board'
import { findNode, neighbours, themes } from './boardOps'

// The "found my idea" summary: the idea you chose, and the trails of links that led to it
// from your starting notes. Plain text so it can be copied anywhere.

export type Summary = {
  idea: BoardNode
  themes: BoardNode[]
  // Each trail runs from a starting note to the idea, shortest way round.
  trails: BoardNode[][]
  favourites: BoardNode[]
}

// Shortest path from `from` to every node it can reach, as parent pointers.
function paths(board: Board, from: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[from, null]])
  const queue = [from]
  while (queue.length) {
    const id = queue.shift()!
    for (const next of neighbours(board, id)) {
      if (parent.has(next)) continue
      parent.set(next, id)
      queue.push(next)
    }
  }
  return parent
}

export function summarise(board: Board): Summary | null {
  const idea = board.nodes.find((n) => n.chosen)
  if (!idea) return null
  const parent = paths(board, idea.id)
  const trails = board.nodes
    .filter((n) => n.kind === 'spark' && n.id !== idea.id && parent.has(n.id))
    .map((start) => {
      const trail: BoardNode[] = []
      for (let id: string | null = start.id; id; id = parent.get(id) ?? null) trail.push(findNode(board, id)!)
      return trail
    })
  return {
    idea,
    themes: themes(board).filter((t) => t.id !== idea.id),
    trails,
    favourites: board.nodes.filter((n) => n.favourite && n.id !== idea.id),
  }
}

const label = (n: BoardNode) => (n.kind === 'spark' && n.category ? `${n.text} (${CATEGORY_LABEL[n.category]})` : n.text)

export function summaryText(board: Board, summary: Summary): string {
  const lines = [`${board.name}`, '', `The idea: ${summary.idea.text}`]
  if (summary.themes.length) lines.push(`${summary.themes.length > 1 ? 'Themes' : 'Theme'}: ${summary.themes.map((t) => t.text).join(', ')}`)
  if (summary.trails.length) {
    lines.push('', 'How I got there:')
    for (const trail of summary.trails) lines.push(`  ${trail.map(label).join(' → ')}`)
  }
  if (summary.favourites.length) {
    lines.push('', 'Other thoughts I liked:')
    for (const f of summary.favourites) lines.push(`  ♥ ${f.text}`)
  }
  lines.push('', 'Made with Floppy Thoughts')
  return lines.join('\n')
}
