import { CATEGORY_LABEL, isFavourite, type Board, type BoardNode } from './board'
import { findNode, neighbours, themes } from './boardOps'

// The summary of a board: the ideas you favourited, and the trails of links that led to each from
// your starting notes. On a shared board the most favourited comes first. Plain text so it can be
// copied anywhere.

export type FavouriteIdea = {
  idea: BoardNode
  // Each trail runs from a starting note to the idea, shortest way round.
  trails: BoardNode[][]
}

export type Summary = {
  ideas: FavouriteIdea[]
  themes: BoardNode[]
  // Favourite notes and nudges: things you liked along the way.
  liked: BoardNode[]
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

function trailsTo(board: Board, idea: BoardNode): BoardNode[][] {
  const parent = paths(board, idea.id)
  return board.nodes
    .filter((n) => n.kind === 'spark' && parent.has(n.id) && n.id !== idea.id)
    .map((start) => {
      const trail: BoardNode[] = []
      for (let id: string | null = start.id; id; id = parent.get(id) ?? null) trail.push(findNode(board, id)!)
      return trail
    })
}

// Favourite ideas, most favourited first (ties keep board order, so the earliest stays ahead).
export const favouriteIdeas = (board: Board) =>
  board.nodes.filter((n) => n.kind === 'user' && isFavourite(n)).sort((a, b) => (b.favouritedBy?.length ?? 0) - (a.favouritedBy?.length ?? 0))

export function summarise(board: Board): Summary | null {
  const ideas = favouriteIdeas(board)
  if (!ideas.length) return null
  return {
    ideas: ideas.map((idea) => ({ idea, trails: trailsTo(board, idea) })),
    themes: themes(board),
    liked: board.nodes.filter((n) => n.kind !== 'user' && n.category !== 'theme' && isFavourite(n)),
  }
}

const label = (n: BoardNode) => (n.kind === 'spark' && n.category ? `${n.text} (${CATEGORY_LABEL[n.category]})` : n.text)

export function summaryText(board: Board, summary: Summary): string {
  const lines = [`${board.name}`]
  if (summary.themes.length) lines.push(`${summary.themes.length > 1 ? 'Themes' : 'Theme'}: ${summary.themes.map((t) => t.text).join(', ')}`)
  for (const { idea, trails } of summary.ideas) {
    lines.push('', `♥ ${idea.text}`)
    if (trails.length) {
      lines.push('  How I got there:')
      for (const trail of trails) lines.push(`    ${trail.map(label).join(' → ')}`)
    }
  }
  if (summary.liked.length) {
    lines.push('', 'Other thoughts I liked:')
    for (const f of summary.liked) lines.push(`  ♥ ${f.text}`)
  }
  lines.push('', 'Made with Floppy Thoughts')
  return lines.join('\n')
}
