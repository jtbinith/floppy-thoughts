import { describe, expect, it } from 'vitest'
import { ME, parseBoard, type Board } from './board'
import { favouritesBoard } from './favouritesBoard'
import { summarise, summaryText } from './summary'

const board: Board = {
  version: 4,
  id: 'b1',
  name: 'time',
  nodes: [
    { id: 'n1', number: 1, text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
    { id: 'n2', number: 2, text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0, favouritedBy: [ME] },
    { id: 'n3', number: 3, text: 'mixtapes for plants', kind: 'user', x: 10, y: 20, favouritedBy: [ME] },
    { id: 'n4', number: 4, text: 'a plant that sings when thirsty', kind: 'user', x: 0, y: 0, favouritedBy: [ME, 'ana', 'kofi'] },
    { id: 'n5', number: 5, text: 'unlinked thought', kind: 'user', x: 0, y: 0 },
  ],
  links: [
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n1', to: 'n4' },
  ],
  createdAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
}

describe('summary of favourited ideas', () => {
  it('lists every favourited idea, most favourited first, with the trail to each', () => {
    const s = summarise(board)!
    expect(s.ideas.map((i) => i.idea.id)).toEqual(['n4', 'n3'])
    expect(s.ideas[0].trails.map((t) => t.map((n) => n.id))).toEqual([['n1', 'n4'], ['n2', 'n3', 'n4']])
    expect(s.ideas[1].trails.map((t) => t.map((n) => n.id))).toEqual([['n1', 'n4', 'n3'], ['n2', 'n3']])
    // Favourite notes are things you liked along the way, not ideas.
    expect(s.liked.map((n) => n.id)).toEqual(['n2'])
    const text = summaryText(board, s)
    expect(text).toContain('cassette (word) → mixtapes for plants → a plant that sings when thirsty')
    expect(text).toContain('Theme: Time')
    expect(text.indexOf('♥ a plant that sings')).toBeLessThan(text.indexOf('♥ mixtapes for plants'))
  })

  it('keeps board order when favourites are level', () => {
    const level = { ...board, nodes: board.nodes.map((n) => (n.id === 'n4' ? { ...n, favouritedBy: [ME] } : n)) }
    expect(summarise(level)!.ideas.map((i) => i.idea.id)).toEqual(['n3', 'n4'])
  })

  it('needs a favourited idea', () => {
    expect(summarise({ ...board, nodes: board.nodes.map((n) => (n.kind === 'user' ? { ...n, favouritedBy: undefined } : n)) })).toBeNull()
  })
})

describe('favourited board', () => {
  it('copies only favourited thoughts and the links between them, with fresh ids', () => {
    const copy = favouritesBoard(board, { id: 'f1' })!
    expect(parseBoard(copy).ok).toBe(true)
    expect(copy.name).toBe('time · favourites')
    expect(copy.nodes.map((n) => [n.number, n.text])).toEqual([
      [1, 'cassette'],
      [2, 'mixtapes for plants'],
      [3, 'a plant that sings when thirsty'],
    ])
    // Fresh ids, not the original board's.
    expect(copy.nodes.some((n) => board.nodes.some((o) => o.id === n.id))).toBe(false)
    expect(copy.links).toEqual([
      { from: copy.nodes[0].id, to: copy.nodes[1].id },
      { from: copy.nodes[1].id, to: copy.nodes[2].id },
    ])
    expect(copy.nodes[1]).toMatchObject({ x: 10, y: 20, favouritedBy: [ME] })
  })

  it('is nothing when nothing is favourited', () => {
    expect(favouritesBoard({ ...board, nodes: [], links: [] })).toBeNull()
  })
})
