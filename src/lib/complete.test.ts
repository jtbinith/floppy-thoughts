import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { complete } from './complete'

const board: Board = {
  version: 1,
  id: 'b',
  name: 'b',
  mode: 'theme',
  swapsLeft: 3,
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
    expect(complete('nu', board)).toEqual({ value: 'nudge ', options: [] })
    expect(complete('bo', board)).toEqual({ value: 'boards ', options: [] })
  })

  it('lists choices when a command is ambiguous', () => {
    expect(complete('l', board)).toEqual({ value: 'li', options: ['link', 'list'] })
    expect(complete('un', board)).toEqual({ value: 'un', options: ['unlink', 'undo'] })
  })

  it('completes node ids for commands that take them', () => {
    expect(complete('link n1 ', board).options).toEqual(['n1', 'n2', 'n3', 'n12'])
    expect(complete('link n1 n1', board)).toEqual({ value: 'link n1 n1', options: ['n1', 'n12'] })
  })

  it('only offers ids that make sense for the command', () => {
    expect(complete('delete ', board).options).toEqual(['n3', 'n12'])
    expect(complete('swap ', board)).toEqual({ value: 'swap n2 ', options: [] })
  })

  it('completes nudge types after the id', () => {
    expect(complete('nudge n2 per', board)).toEqual({ value: 'nudge n2 perspective ', options: [] })
    expect(complete('nudge n2 s', board).options).toEqual(['scale', 'senses'])
  })

  it('completes board numbers for open', () => {
    expect(complete('open ', board, 3).options).toEqual(['1', '2', '3'])
  })

  it('leaves free text alone', () => {
    expect(complete('add mixt', board)).toEqual({ value: 'add mixt', options: [] })
    expect(complete('edit n3 dog', board)).toEqual({ value: 'edit n3 dog', options: [] })
  })
})
