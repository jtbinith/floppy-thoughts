import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { HELP, runCommand } from './commands'

const ctx = { addAt: { x: 5, y: 5 }, now: new Date('2026-10-28T12:00:00Z') }

const board: Board = {
  version: 1,
  id: 'b1',
  name: 'test',
  mode: 'theme',
  swapsLeft: 3,
  nodes: [
    { id: 'n1', text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
    { id: 'n2', text: 'plants', kind: 'user', x: 100, y: 50 },
  ],
  links: [{ from: 'n1', to: 'n2' }],
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
}

describe('terminal commands', () => {
  it('prints help', () => {
    expect(runCommand(board, 'help', ctx).output).toEqual(HELP)
  })

  it('ignores empty input', () => {
    expect(runCommand(board, '   ', ctx)).toEqual({ output: [] })
  })

  it('adds an idea with the rest of the line as text', () => {
    const r = runCommand(board, 'add  mixtapes for plants', ctx)
    expect(r.output).toEqual(['added n3: mixtapes for plants'])
    expect(r.board?.nodes.at(-1)).toMatchObject({ id: 'n3', kind: 'user', x: 5, y: 5 })
  })

  it('edits and deletes by id', () => {
    expect(runCommand(board, 'edit n2 bonsai', ctx).output).toEqual(['edited n2: bonsai'])
    const r = runCommand(board, 'delete n2', ctx)
    expect(r.output).toEqual(['deleted n2: plants'])
    expect(r.board?.links).toEqual([])
  })

  it('accepts rm as a shortcut and is case-insensitive', () => {
    expect(runCommand(board, 'RM n2', ctx).board).toBeDefined()
  })

  it('reports errors without changing the board', () => {
    for (const input of ['add', 'edit n2', 'delete', 'delete n1', 'edit n9 x', 'dance']) {
      const r = runCommand(board, input, ctx)
      expect(r.error, input).toBe(true)
      expect(r.board, input).toBeUndefined()
    }
    expect(runCommand(board, 'dance', ctx).output).toEqual(['unknown command "dance". type help'])
  })

  it('lists nodes with their ids and kinds', () => {
    expect(runCommand(board, 'list', ctx).output).toEqual([
      '  n1   theme       Time  ↔ n2',
      '  n2   idea        plants  ↔ n1',
    ])
  })

  it('links and unlinks nodes in either order', () => {
    const unlinked = runCommand(board, 'unlink n2 n1', ctx)
    expect(unlinked.output).toEqual(['unlinked n2 ↔ n1'])
    expect(unlinked.board?.links).toEqual([])
    const relinked = runCommand(unlinked.board!, 'link n1 n2', ctx)
    expect(relinked.board?.links).toEqual([{ from: 'n1', to: 'n2' }])
  })

  it('rejects bad links', () => {
    expect(runCommand(board, 'link n1 n2', ctx).output).toEqual(['n1 and n2 are already linked'])
    expect(runCommand(board, 'link n1 n1', ctx).output).toEqual(['A node cannot link to itself'])
    expect(runCommand(board, 'link n1 n9', ctx).output).toEqual(['No node called n9'])
    expect(runCommand(board, 'link n1', ctx).output).toEqual(['usage: link <id> <id>'])
    expect(runCommand(board, 'unlink n1 n9', ctx).error).toBe(true)
  })

  it('signals clear', () => {
    expect(runCommand(board, 'clear', ctx).clear).toBe(true)
  })
})
