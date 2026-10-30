import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { HELP, looksLikeCommand, runCommand } from './commands'

const ctx = { addAt: { x: 5, y: 5 }, now: new Date('2026-10-28T12:00:00Z') }

const board: Board = {
  version: 2,
  id: 'b1',
  name: 'test',
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
    for (const input of ['delete n9', 'edit n9 x', 'link n1 n9', 'fav n9']) {
      const r = runCommand(board, input, ctx)
      expect(r.error, input).toBe(true)
      expect(r.board, input).toBeUndefined()
    }
  })

  it('adds anything that is not clearly a command as an idea', () => {
    for (const input of ['mixtapes for plants', 'help my nan with video calls', 'link music and maths', 'delete spam automatically', 'dance']) {
      const r = runCommand(board, input, ctx)
      expect(r.output, input).toEqual([`added n3: ${input}`])
      expect(r.board?.nodes.at(-1)?.kind).toBe('user')
    }
    expect(looksLikeCommand('help')).toBe(true)
    expect(looksLikeCommand('link n1 n2')).toBe(true)
    expect(looksLikeCommand('nudge n2 scale')).toBe(true)
    expect(looksLikeCommand('open 2')).toBe(true)
    expect(looksLikeCommand('open sesame')).toBe(false)
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
    expect(runCommand(board, 'link n1', ctx).output).toEqual(['added n3: link n1'])
    expect(runCommand(board, 'unlink n1 n9', ctx).error).toBe(true)
  })

  it('signals clear', () => {
    expect(runCommand(board, 'clear', ctx).clear).toBe(true)
  })
})

describe('notes, favourites and names', () => {
  it('sets the main theme, and changes it rather than adding a second', () => {
    const blank = { ...board, nodes: board.nodes.filter((n) => n.kind === 'user'), links: [] }
    const r = runCommand(blank, 'theme Time travel', ctx)
    expect(r.output).toEqual(['main theme n3: Time travel'])
    expect(r.board?.nodes.at(-1)).toMatchObject({ kind: 'spark', category: 'theme', locked: true })
    const changed = runCommand(r.board!, 'theme Space', ctx)
    expect(changed.board?.nodes.filter((n) => n.category === 'theme').map((n) => n.text)).toEqual(['Space'])
  })

  it('picks the idea you are going with', () => {
    const r = runCommand(board, 'pick n2', ctx)
    expect(r.output).toEqual(['n2 is the one: plants'])
    expect(runCommand(r.board!, 'pick n2', ctx).output).toEqual(['n2 is no longer the one'])
  })

  it('toggles favourites and shows them in the list', () => {
    const r = runCommand(board, 'fav n2', ctx)
    expect(r.output).toEqual(['♥ favourited n2: plants'])
    expect(runCommand(r.board!, 'list', ctx).output[1]).toBe('  n2   idea        ♥ plants  ↔ n1')
    expect(runCommand(r.board!, 'fav n2', ctx).output).toEqual(['unfavourited n2: plants'])
  })

  it('renames the board', () => {
    expect(runCommand(board, 'rename  Time   machine ', ctx).board?.name).toBe('Time machine')
    expect(runCommand(board, 'rename', ctx).board?.name).toBe(board.name)
  })

  it('says when the board is empty', () => {
    expect(runCommand({ ...board, nodes: [], links: [] }, 'list', ctx).output).toEqual(['  the board is empty. type a thought, or try: vend'])
  })
})
