import { describe, expect, it } from 'vitest'
import { MAX_NODES, MAX_NODE_TEXT, ME, parseBoard, type Board } from './board'
import { BOARD_FULL_MESSAGE, addLink, addNote, addUserNode, chainAround, deleteNodes, deleteUserNode, editUserNode, addTheme, mainTheme, nextNumber, removeLink, themes, toggleFavourite } from './boardOps'

const now = new Date('2026-10-28T12:00:00Z')

function board(): Board {
  return {
    version: 4,
    id: 'b1',
    name: 'test',
    nodes: [
      { id: 'n1', number: 1, text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 },
      { id: 'n2', number: 2, text: 'plants', kind: 'user', x: 100, y: 50 },
      { id: 'n7', number: 7, text: 'what does it sound like?', kind: 'nudge', nudgeType: 'senses', x: 0, y: 90 },
    ],
    links: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n7' },
      { from: 'n1', to: 'n7' },
    ],
    createdAt: '2026-10-28T10:00:00Z',
    updatedAt: '2026-10-28T10:00:00Z',
  }
}

const expectOk = (r: ReturnType<typeof addUserNode>) => {
  if (!r.ok) throw new Error(r.error)
  expect(parseBoard(r.board).ok).toBe(true)
  return r
}

describe('board operations', () => {
  it('gives new nodes a random id and the next free number', () => {
    expect(nextNumber(board())).toBe(8)
    const a = expectOk(addUserNode(board(), 'one', { x: 0, y: 0 })).node!
    const b = expectOk(addUserNode(board(), 'two', { x: 0, y: 0 })).node!
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(a.id).not.toBe(b.id)
  })

  it('adds a user node with cleaned text at a rounded position', () => {
    const r = expectOk(addUserNode(board(), '  mixtapes   for\nplants ', { x: 10.4, y: 20.6 }, now))
    expect(r.node).toEqual({ id: expect.any(String), number: 8, text: 'mixtapes for plants', kind: 'user', x: 10, y: 21 })
    expect(r.board.updatedAt).toBe(now.toISOString())
  })

  it('cuts text to the maximum length', () => {
    const r = expectOk(addUserNode(board(), 'a'.repeat(MAX_NODE_TEXT + 50), { x: 0, y: 0 }))
    expect(r.node?.text).toHaveLength(MAX_NODE_TEXT)
  })

  it('refuses empty text', () => {
    expect(addUserNode(board(), '   ', { x: 0, y: 0 }).ok).toBe(false)
    expect(editUserNode(board(), 'n2', '').ok).toBe(false)
  })

  it('edits only user nodes', () => {
    expect(expectOk(editUserNode(board(), 'n2', 'mixtapes', now)).node?.text).toBe('mixtapes')
    expect(editUserNode(board(), 'n1', 'hacked')).toEqual({
      ok: false,
      error: '1 is a note: only your own ideas can be edited',
    })
    expect(editUserNode(board(), 'n99', 'x')).toEqual({ ok: false, error: 'Nothing numbered 99' })
  })

  it('deletes anything, with its links', () => {
    const r = expectOk(deleteUserNode(board(), 'n2', now))
    expect(r.board.nodes.map((n) => n.id)).toEqual(['n1', 'n7'])
    expect(r.board.links).toEqual([{ from: 'n1', to: 'n7' }])
    expect(expectOk(deleteUserNode(board(), 'n7')).board.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(expectOk(deleteUserNode(board(), 'n1')).board.links).toEqual([{ from: 'n2', to: 'n7' }])
  })

  it('never mutates the original board', () => {
    const original = board()
    const copy = structuredClone(original)
    addUserNode(original, 'x', { x: 0, y: 0 })
    editUserNode(original, 'n2', 'y')
    deleteUserNode(original, 'n2')
    expect(original).toEqual(copy)
  })

  it('links any two nodes once, and the result is still a valid board', () => {
    const added = expectOk(addUserNode(board(), 'radio', { x: 0, y: 0 })).board
    const radio = added.nodes.at(-1)!.id
    const r = expectOk(addLink(added, 'n1', radio, now))
    expect(r.board.links.at(-1)).toEqual({ from: 'n1', to: radio })
    // The sample board already links n2 and n7, so either order is a duplicate.
    expect(addLink(board(), 'n7', 'n2')).toEqual({ ok: false, error: '7 and 2 are already linked' })
    expect(addLink(board(), 'n1', 'n1').ok).toBe(false)
  })

  it('removes a link whichever way round it is given', () => {
    const r = expectOk(removeLink(board(), 'n2', 'n1', now))
    expect(r.board.links).toEqual([
      { from: 'n2', to: 'n7' },
      { from: 'n1', to: 'n7' },
    ])
  })

  it('has no limit on ideas, only a safety cap far beyond normal use', () => {
    let b = board()
    for (let i = 0; i < 50; i++) b = expectOk(addUserNode(b, 'idea', { x: 0, y: 0 })).board
    expect(b.nodes).toHaveLength(53)
    const huge = { ...b, nodes: Array.from({ length: MAX_NODES }, (_, i) => ({ id: `n${i + 1}`, number: i + 1, text: 'x', kind: 'user' as const, x: 0, y: 0 })), links: [] }
    expect(addUserNode(huge, 'one more', { x: 0, y: 0 })).toEqual({ ok: false, error: BOARD_FULL_MESSAGE })
  })

  it('adds notes, locking themes', () => {
    const r = expectOk(addNote(board(), { text: 'Time', category: 'theme' }, { x: 1, y: 2 }))
    expect(r.node).toEqual({ id: expect.any(String), number: 8, text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 1, y: 2 })
    expect(expectOk(addNote(board(), { text: 'kite', category: 'words' }, { x: 0, y: 0 })).node).not.toHaveProperty('locked')
  })

  it('toggles favourites on any kind of node, one per person', () => {
    const on = expectOk(toggleFavourite(board(), 'n1', ME, now))
    expect(on.node?.favouritedBy).toEqual([ME])
    const both = expectOk(toggleFavourite(on.board, 'n1', 'someone-else', now))
    expect(both.node?.favouritedBy).toEqual([ME, 'someone-else'])
    const theirs = expectOk(toggleFavourite(both.board, 'n1', ME, now))
    expect(theirs.node?.favouritedBy).toEqual(['someone-else'])
    const off = expectOk(toggleFavourite(theirs.board, 'n1', 'someone-else', now))
    expect(off.node).not.toHaveProperty('favourites')
    expect(toggleFavourite(board(), 'n99').ok).toBe(false)
  })
})

describe('deleting from a chain', () => {
  // n1 — n2 — n3, plus a hub n4 linked to three things.
  const chain = (): Board => ({
    ...board(),
    nodes: [
      { id: 'n1', number: 1, text: 'a', kind: 'user', x: 0, y: 0 },
      { id: 'n2', number: 2, text: 'b', kind: 'user', x: 0, y: 0 },
      { id: 'n3', number: 3, text: 'c', kind: 'user', x: 0, y: 0 },
      { id: 'n4', number: 4, text: 'hub', kind: 'user', x: 0, y: 0 },
      { id: 'n5', number: 5, text: 'e', kind: 'user', x: 0, y: 0 },
    ],
    links: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n4', to: 'n1' },
      { from: 'n4', to: 'n3' },
      { from: 'n4', to: 'n5' },
    ],
  })

  it('spots a node in the middle of a chain, not a hub or an end', () => {
    expect(chainAround(chain(), 'n2')).toEqual(['n1', 'n3'])
    expect(chainAround(chain(), 'n4')).toBeNull()
    expect(chainAround(chain(), 'n5')).toBeNull()
  })

  it('reconnects the chain only when asked', () => {
    expect(deleteNodes(chain(), ['n2'], { reconnect: true }).links).toContainEqual({ from: 'n1', to: 'n3' })
    expect(deleteNodes(chain(), ['n2']).links).not.toContainEqual({ from: 'n1', to: 'n3' })
    expect(parseBoard(deleteNodes(chain(), ['n2', 'n4'], { reconnect: true })).ok).toBe(true)
  })
})

describe('themes and the chosen idea', () => {
  it('can have several themes; the first one is the main one', () => {
    const first = expectOk(addTheme(board(), 'Time', { x: 0, y: 0 })).board
    const second = expectOk(addTheme(first, 'Space', { x: 9, y: 9 })).board
    expect(themes(second).map((n) => n.text)).toEqual(['Time', 'Space'])
    expect(themes(second).every((n) => n.locked)).toBe(true)
    expect(mainTheme(second)?.text).toBe('Time')
  })

  it('edits a theme like an idea', () => {
    const withTheme = expectOk(addTheme(board(), 'Time', { x: 0, y: 0 }))
    const edited = expectOk(editUserNode(withTheme.board, withTheme.node!.id, 'Time travel')).board
    expect(themes(edited).map((n) => n.text)).toEqual(['Time travel'])
  })

})
