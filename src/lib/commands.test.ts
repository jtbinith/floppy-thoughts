import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { HELP, helpGroups, looksLikeCommand, runCommand } from './commands'

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
    expect(runCommand(board, '/help', ctx).output).toEqual(HELP)
  })

  it('ignores empty input', () => {
    expect(runCommand(board, '   ', ctx)).toEqual({ output: [] })
  })

  it('adds a typed thought as an idea', () => {
    const r = runCommand(board, '  mixtapes for plants ', ctx)
    expect(r.output).toEqual(['added 3: mixtapes for plants'])
    expect(r.board?.nodes.at(-1)).toMatchObject({ id: 'n3', kind: 'user', x: 5, y: 5 })
  })

  it('edits and deletes by id', () => {
    expect(runCommand(board, '/edit 2 bonsai', ctx).output).toEqual(['edited 2: bonsai'])
    const r = runCommand(board, '/delete 2', ctx)
    expect(r.output).toEqual(['deleted 2: plants'])
    expect(r.board?.links).toEqual([])
  })

  it('deletes with del, and still accepts delete and rm, in any case', () => {
    expect(runCommand(board, '/del 2', ctx).output).toEqual(['deleted 2: plants'])
    expect(runCommand(board, '/RM 2', ctx).board).toBeDefined()
    expect(runCommand(board, '/Delete 2', ctx).board).toBeDefined()
  })

  it('reports errors without changing the board', () => {
    for (const input of ['/delete 9', '/edit 9 x', '/link 1 9', '/fav 9', '/link 1', '/dance']) {
      const r = runCommand(board, input, ctx)
      expect(r.error, input).toBe(true)
      expect(r.board, input).toBeUndefined()
    }
  })

  it('adds anything without a / as an idea, even if it starts like a command', () => {
    for (const input of ['mixtapes for plants', 'help my nan with video calls', 'link music and maths', 'delete spam automatically', 'dance']) {
      const r = runCommand(board, input, ctx)
      expect(r.output, input).toEqual([`added 3: ${input}`])
      expect(r.board?.nodes.at(-1)?.kind).toBe('user')
    }
    expect(looksLikeCommand('/help')).toBe(true)
    expect(looksLikeCommand('  /link n1 n2')).toBe(true)
    expect(looksLikeCommand('help')).toBe(false)
    expect(looksLikeCommand('/')).toBe(false)
  })

  it('lists nodes with their ids and kinds', () => {
    expect(runCommand(board, '/list', ctx).output).toEqual([
      '  1   main theme  Time  (linked to 2)',
      '  2   idea        plants  (linked to 1)',
    ])
  })

  it('links and unlinks nodes in either order', () => {
    const unlinked = runCommand(board, '/unlink 2 1', ctx)
    expect(unlinked.output).toEqual(['unlinked 2 from 1'])
    expect(unlinked.board?.links).toEqual([])
    const relinked = runCommand(unlinked.board!, '/link 1 2', ctx)
    expect(relinked.board?.links).toEqual([{ from: 'n1', to: 'n2' }])
  })

  it('rejects bad links', () => {
    expect(runCommand(board, '/link 1 2', ctx).output).toEqual(['1 and 2 are already linked'])
    expect(runCommand(board, '/link 1 1', ctx).output).toEqual(['A node cannot link to itself'])
    expect(runCommand(board, '/link 1 9', ctx).output).toEqual(['Nothing numbered 9'])
    expect(runCommand(board, '/link 1', ctx).output).toEqual(['usage: /link <id> <id>…'])
    expect(runCommand(board, '/dance', ctx).output).toEqual(["there's no /dance command. type /help for them all"])
    expect(runCommand(board, '/unlink 1 9', ctx).error).toBe(true)
  })

  it('signals clear', () => {
    expect(runCommand(board, '/clear', ctx).clear).toBe(true)
  })
})

describe('notes, favourites and names', () => {
  it('sets the main theme, and changes it rather than adding a second', () => {
    const blank = { ...board, nodes: board.nodes.filter((n) => n.kind === 'user'), links: [] }
    const r = runCommand(blank, '/theme Time travel', ctx)
    expect(r.output).toEqual(['main theme 3: Time travel'])
    expect(r.board?.nodes.at(-1)).toMatchObject({ kind: 'spark', category: 'theme', locked: true })
    const changed = runCommand(r.board!, '/theme Space', ctx)
    expect(changed.board?.nodes.filter((n) => n.category === 'theme').map((n) => n.text)).toEqual(['Space'])
  })

  it('picks the idea you are going with', () => {
    const r = runCommand(board, '/pick 2', ctx)
    expect(r.output).toEqual(['2 is the one: plants'])
    expect(runCommand(r.board!, '/pick 2', ctx).output).toEqual(['2 is no longer the one'])
  })

  it('toggles favourites and shows them in the list', () => {
    const r = runCommand(board, '/fav 2', ctx)
    expect(r.output).toEqual(['♥ favourited 2: plants'])
    expect(runCommand(r.board!, '/list', ctx).output[1]).toBe('  2   idea        ♥ plants  (linked to 1)')
    expect(runCommand(r.board!, '/fav 2', ctx).output).toEqual(['unfavourited 2: plants'])
  })

  it('renames the board', () => {
    expect(runCommand(board, '/rename  Time   machine ', ctx).board?.name).toBe('Time machine')
    expect(runCommand(board, '/rename', ctx).error).toBe(true)
  })

  it('says when the board is empty', () => {
    expect(runCommand({ ...board, nodes: [], links: [] }, '/list', ctx).output).toEqual(['  the board is empty. type a thought, or try /vend'])
  })
})

describe('linking several at once', () => {
  const three: Board = {
    ...board,
    nodes: [...board.nodes, { id: 'n3', text: 'a', kind: 'user', x: 0, y: 0 }, { id: 'n4', text: 'b', kind: 'user', x: 0, y: 0 }],
    links: [],
  }
  it('links the first to each of the others', () => {
    const r = runCommand(three, '/link 4 2 3', ctx)
    expect(r.output).toEqual(['linked 4 to 2 and 3'])
    expect(r.board?.links).toEqual([
      { from: 'n4', to: 'n2' },
      { from: 'n4', to: 'n3' },
    ])
  })

  it('changes nothing if any of them fails', () => {
    expect(runCommand(three, '/link 4 2 9', ctx).error).toBe(true)
  })
})

describe('help groups for the commands tab', () => {
  it('splits the help into groups of what you type and what it does', () => {
    const groups = helpGroups()
    expect(groups[0].heading).toBe('IDEAS')
    const links = groups.find((g) => g.heading === 'LINKS')!
    expect(links.entries[0]).toEqual({ usage: '/link <id> <id>…', does: 'link two things, or the first to each of the rest: /link 4 2 5 links 4 to 2 and to 5' })
    // The nudge types carry on the nudge line rather than being their own entry.
    const nudge = groups.flatMap((g) => g.entries).find((e) => e.usage.startsWith('/nudge'))!
    expect(nudge.does).toContain('types: related')
    // Tips have no command, just text.
    expect(groups.find((g) => g.heading === 'TIPS')!.entries.every((e) => e.usage === '')).toBe(true)
  })
})

describe('unlinking everything from one thought', () => {
  const hub: Board = {
    ...board,
    nodes: [...board.nodes, { id: 'n3', text: 'a', kind: 'user', x: 0, y: 0 }, { id: 'n4', text: 'b', kind: 'user', x: 0, y: 0 }],
    links: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n4', to: 'n2' },
      { from: 'n3', to: 'n4' },
    ],
  }

  it('clears every link to it, and keeps the thought', () => {
    const r = runCommand(hub, '/unlink 2', ctx)
    expect(r.output).toEqual(['unlinked 2 from 1, 3 and 4'])
    expect(r.board?.links).toEqual([{ from: 'n3', to: 'n4' }])
    expect(r.board?.nodes).toHaveLength(4)
  })

  it('says so when there was nothing to unlink', () => {
    const r = runCommand({ ...hub, links: [] }, '/unlink 2', ctx)
    expect(r.error).toBe(true)
    expect(r.output).toEqual(["2 isn't linked to anything"])
  })
})
