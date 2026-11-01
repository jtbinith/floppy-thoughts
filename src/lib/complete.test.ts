import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { complete } from './complete'

const board: Board = {
  version: 2,
  id: 'b',
  name: 'b',
  nodes: [
    { id: 'n1', text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
    { id: 'n2', text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 },
    { id: 'n3', text: 'radio', kind: 'user', x: 0, y: 0 },
    { id: 'n12', text: 'dog radio', kind: 'user', x: 0, y: 0 },
  ],
  links: [],
  createdAt: '2026-10-29T10:00:00Z',
  updatedAt: '2026-10-29T10:00:00Z',
}

describe('tab completion', () => {
  it('completes a unique command and adds a space', () => {
    expect(complete('/nu', board)).toEqual({ value: '/nudge ', options: [] })
    expect(complete('/bo', board)).toEqual({ value: '/boards ', options: [] })
  })

  it('lists choices when a command is ambiguous', () => {
    expect(complete('/l', board)).toEqual({ value: '/li', options: ['/link', '/list'] })
    expect(complete('/un', board)).toEqual({ value: '/un', options: ['/unlink', '/undo'] })
    // A thought isn't completed.
    expect(complete('un', board)).toEqual({ value: 'un', options: [] })
  })

  it('completes node ids for commands that take them', () => {
    // Typing a number lists what it could be, with the words, so you can see which is which.
    expect(complete('/link 1 1', board).options).toEqual(['  1  Time', ' 12  dog radio'])
    expect(complete('/link 1 3', board)).toEqual({ value: '/link 1 3 ', options: [] })
  })

  it('only offers ids that make sense for the command', () => {
    expect(complete('/edit ', board).options).toEqual(['  1  Time', '  3  radio', ' 12  dog radio'])
  })

  it('finds a thought by its words and fills in its number', () => {
    expect(complete('/fav cass', board)).toEqual({ value: '/fav 2 ', options: [] })
    expect(complete('/link 1 rad', board).options).toEqual(['  3  radio', ' 12  dog radio'])
    expect(complete('/link 1 dog', board)).toEqual({ value: '/link 1 12 ', options: [] })
  })

  it('completes nudge types after the id', () => {
    expect(complete('/nudge 2 per', board)).toEqual({ value: '/nudge 2 perspective ', options: [] })
    expect(complete('/nudge 2 s', board).options).toEqual(['scale', 'senses'])
  })

  it('completes board numbers for open', () => {
    expect(complete('/open ', board, 3).options).toEqual(['1', '2', '3'])
  })

  it('leaves free text alone', () => {
    expect(complete('/add mixt', board)).toEqual({ value: '/add mixt', options: [] })
    expect(complete('/edit 3 dog', board)).toEqual({ value: '/edit 3 dog', options: [] })
  })
})
