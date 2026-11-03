import { describe, expect, it } from 'vitest'
import { findBoards } from './findBoards'
import type { BoardSummary } from './storage'

const board = (name: string, created: string, edited: string, thoughts: string[] = []): BoardSummary => ({
  id: name,
  name,
  createdAt: `2026-10-${created}T00:00:00.000Z`,
  updatedAt: `2026-10-${edited}T00:00:00.000Z`,
  thoughts,
  sketch: { nodes: [], links: [] },
})

const boards = [
  board('board 2', '02', '20', ['teapot', 'beehive']),
  board('board 10', '10', '11', ['Time', 'a slow internet day']),
  board('Shrimp', '05', '30', ['tortoise']),
]
const names = (list: BoardSummary[]) => list.map((b) => b.name)

describe('finding boards', () => {
  it('matches the name or any thought, ignoring case', () => {
    expect(names(findBoards(boards, 'shrimp', 'edited'))).toEqual(['Shrimp'])
    expect(names(findBoards(boards, 'TEAPOT', 'edited'))).toEqual(['board 2'])
  })

  it('needs every word, but not in the same thought', () => {
    expect(names(findBoards(boards, 'time slow', 'edited'))).toEqual(['board 10'])
    expect(findBoards(boards, 'time teapot', 'edited')).toEqual([])
  })

  it('shows everything when the search is empty', () => {
    expect(findBoards(boards, '  ', 'edited')).toHaveLength(3)
  })

  it('sorts by last edited, newest, oldest or name', () => {
    expect(names(findBoards(boards, '', 'edited'))).toEqual(['Shrimp', 'board 2', 'board 10'])
    expect(names(findBoards(boards, '', 'newest'))).toEqual(['board 10', 'Shrimp', 'board 2'])
    expect(names(findBoards(boards, '', 'oldest'))).toEqual(['board 2', 'Shrimp', 'board 10'])
    // Numbers in names sort as numbers: board 2 before board 10.
    expect(names(findBoards(boards, '', 'name'))).toEqual(['board 2', 'board 10', 'Shrimp'])
  })
})
