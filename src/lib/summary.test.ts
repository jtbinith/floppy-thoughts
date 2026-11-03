import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { favouritesBoard } from './favouritesBoard'
import { summarise, summaryText } from './summary'
import { parseBoard } from './board'

const board: Board = {
  version: 3,
  id: 'b1',
  name: 'time',
  nodes: [
    { id: 'n1', number: 1, text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
    { id: 'n2', number: 2, text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0, favourite: true },
    { id: 'n3', number: 3, text: 'mixtapes for plants', kind: 'user', x: 10, y: 20, favourite: true },
    { id: 'n4', number: 4, text: 'a plant that sings when thirsty', kind: 'user', x: 0, y: 0, chosen: true },
    { id: 'n5', number: 5, text: 'unlinked thought', kind: 'user', x: 0, y: 0, favourite: true },
  ],
  links: [
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n1', to: 'n4' },
  ],
  createdAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
}

describe('idea summary', () => {
  it('traces each starting note to the chosen idea', () => {
    const s = summarise(board)!
    expect(s.idea.id).toBe('n4')
    expect(s.trails.map((t) => t.map((n) => n.id))).toEqual([['n1', 'n4'], ['n2', 'n3', 'n4']])
    expect(summaryText(board, s)).toContain('cassette (word) → mixtapes for plants → a plant that sings when thirsty')
    expect(summaryText(board, s)).toContain('Theme: Time')
  })

  it('needs a chosen idea', () => {
    expect(summarise({ ...board, nodes: board.nodes.map((n) => ({ ...n, chosen: undefined })) })).toBeNull()
  })
})

describe('favourites board', () => {
  it('copies only favourites and the links between them, with fresh ids', () => {
    const fav = favouritesBoard(board, { id: 'f1' })!
    expect(parseBoard(fav).ok).toBe(true)
    expect(fav.name).toBe('time · favourites')
    expect(fav.nodes.map((n) => [n.number, n.text])).toEqual([
      [1, 'cassette'],
      [2, 'mixtapes for plants'],
      [3, 'unlinked thought'],
    ])
    // Fresh ids, not the original board's.
    expect(fav.nodes.some((n) => board.nodes.some((o) => o.id === n.id))).toBe(false)
    expect(fav.links).toEqual([{ from: fav.nodes[0].id, to: fav.nodes[1].id }])
    expect(fav.nodes[1]).toMatchObject({ x: 10, y: 20 })
  })

  it('is nothing when there are no favourites', () => {
    expect(favouritesBoard({ ...board, nodes: [], links: [] })).toBeNull()
  })
})
