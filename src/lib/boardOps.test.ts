import { describe, expect, it } from 'vitest'
import { BOARD_CAPACITY, MAX_NODE_TEXT, parseBoard, type Board } from './board'
import { BOARD_FULL_MESSAGE, addLink, addUserNode, deleteUserNode, editUserNode, nextNodeId, removeLink, spaceLeft } from './boardOps'

const now = new Date('2026-10-28T12:00:00Z')

function board(): Board {
  return {
    version: 1,
    id: 'b1',
    name: 'test',
    mode: 'blank',
    swapsLeft: 3,
    nodes: [
      { id: 'n1', text: 'cassette', kind: 'spark', category: 'words', x: 0, y: 0 },
      { id: 'n2', text: 'plants', kind: 'user', x: 100, y: 50 },
      { id: 'n7', text: 'what does it sound like?', kind: 'nudge', nudgeType: 'senses', x: 0, y: 90 },
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
  it('gives new nodes the next free short id', () => {
    expect(nextNodeId(board())).toBe('n8')
  })

  it('adds a user node with cleaned text at a rounded position', () => {
    const r = expectOk(addUserNode(board(), '  mixtapes   for\nplants ', { x: 10.4, y: 20.6 }, now))
    expect(r.node).toEqual({ id: 'n8', text: 'mixtapes for plants', kind: 'user', x: 10, y: 21 })
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
      error: 'n1 is a disk: only your own ideas can be edited',
    })
    expect(editUserNode(board(), 'n99', 'x')).toEqual({ ok: false, error: 'No node called n99' })
  })

  it('deletes ideas and nudges with their links, but never sparks', () => {
    const r = expectOk(deleteUserNode(board(), 'n2', now))
    expect(r.board.nodes.map((n) => n.id)).toEqual(['n1', 'n7'])
    expect(r.board.links).toEqual([{ from: 'n1', to: 'n7' }])
    expect(expectOk(deleteUserNode(board(), 'n7')).board.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(deleteUserNode(board(), 'n1')).toEqual({ ok: false, error: 'n1 is a disk: disks can be swapped, not deleted' })
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
    const r = expectOk(addLink(added, 'n1', 'n8', now))
    expect(r.board.links.at(-1)).toEqual({ from: 'n1', to: 'n8' })
    // The sample board already links n2 and n7, so either order is a duplicate.
    expect(addLink(board(), 'n7', 'n2')).toEqual({ ok: false, error: 'n7 and n2 are already linked' })
    expect(addLink(board(), 'n1', 'n1').ok).toBe(false)
  })

  it('removes a link whichever way round it is given', () => {
    const r = expectOk(removeLink(board(), 'n2', 'n1', now))
    expect(r.board.links).toEqual([
      { from: 'n2', to: 'n7' },
      { from: 'n1', to: 'n7' },
    ])
  })

  it('stops adding when the board is full, and makes room again after a delete', () => {
    let b = board()
    expect(spaceLeft(b)).toBe(BOARD_CAPACITY - 3)
    while (spaceLeft(b) > 0) b = expectOk(addUserNode(b, 'idea', { x: 0, y: 0 })).board
    expect(b.nodes).toHaveLength(BOARD_CAPACITY)
    expect(addUserNode(b, 'one more', { x: 0, y: 0 })).toEqual({ ok: false, error: BOARD_FULL_MESSAGE })
    const freed = expectOk(deleteUserNode(b, 'n2')).board
    expect(addUserNode(freed, 'fits now', { x: 0, y: 0 }).ok).toBe(true)
  })
})
