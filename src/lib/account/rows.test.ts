import { describe, expect, it } from 'vitest'
import { ME, type Board } from '../board'
import { changeBetween } from '../changes'
import { boardFromRows, forUpload, linkRow, nodeFields, rowsOfChange, type FavouriteRow, type LinkRow, type NodeRow } from './rows'

const me = 'aaaaaaaa-0000-0000-0000-000000000001'
const ana = 'aaaaaaaa-0000-0000-0000-000000000002'

const board: Board = {
  version: 4,
  id: 'b0000000-0000-0000-0000-000000000001',
  name: 'Time',
  nodes: [
    { id: 'c0000000-0000-0000-0000-000000000001', number: 1, text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 0, y: 0 },
    { id: 'c0000000-0000-0000-0000-000000000002', number: 2, text: 'clocks', kind: 'user', x: 10, y: 20, favouritedBy: [ME, ana] },
    { id: 'c0000000-0000-0000-0000-000000000003', number: 3, text: 'what if it ran backwards?', kind: 'nudge', nudgeType: 'opposite', x: 5, y: 5 },
  ],
  links: [{ from: 'c0000000-0000-0000-0000-000000000002', to: 'c0000000-0000-0000-0000-000000000001' }],
  createdAt: '2026-11-03T10:00:00.000Z',
  updatedAt: '2026-11-03T11:00:00.000Z',
}

// The rows the database would hold for that board.
const asRows = () => {
  const nodes: NodeRow[] = board.nodes.map((n) => ({ ...nodeFields(n), board_id: board.id }))
  const links: LinkRow[] = board.links.map((l) => linkRow(board.id, l))
  const favourites: FavouriteRow[] = [
    { board_id: board.id, node_id: board.nodes[1].id, user_id: me },
    { board_id: board.id, node_id: board.nodes[1].id, user_id: ana },
  ]
  return { nodes, links, favourites }
}

describe('board ↔ rows', () => {
  it('reads a board back from its rows, with you as ME', () => {
    const { nodes, links, favourites } = asRows()
    const result = boardFromRows(
      { id: board.id, name: 'Time', created_at: '2026-11-03 10:00:00+00', updated_at: '2026-11-03T11:00:00Z' },
      [...nodes].reverse(),
      links,
      favourites,
      me,
    )
    if (!result.ok) throw new Error(result.errors.join())
    // Links come back smaller id first; otherwise it's the same board.
    expect(result.board).toEqual({ ...board, links: [{ from: board.nodes[0].id, to: board.nodes[1].id }] })
  })

  it('stores each link once, smaller id first', () => {
    expect(linkRow('b', { from: 'z', to: 'a' })).toEqual({ board_id: 'b', node_a: 'a', node_b: 'z' })
  })

  it('turns a change into rows: your favourites only, as your account', () => {
    const edited = { ...board, nodes: board.nodes.map((n) => (n.number === 3 ? { ...n, favouritedBy: [ME] } : n.number === 2 ? { ...n, favouritedBy: [ana] } : n)) }
    const rows = rowsOfChange(changeBetween(board, edited), me)
    expect(rows.nodes.map((n) => n.number)).toEqual([2, 3])
    expect(rows.nodes[0]).not.toHaveProperty('board_id')
    expect(rows.favourites).toEqual({ add: [{ board_id: board.id, node_id: board.nodes[2].id, user_id: me }], remove: [board.nodes[1].id] })
  })
})

describe('uploading a browser board', () => {
  it('gets new ids, with links and favourites following, and nothing else changed', () => {
    const old: Board = { ...board, nodes: board.nodes.map((n, i) => ({ ...n, id: `n${i + 1}` })), links: [{ from: 'n2', to: 'n1' }] }
    let i = 0
    const up = forUpload(old, () => `d0000000-0000-0000-0000-00000000000${i++}`)
    expect(up.id).not.toBe(old.id)
    expect(up.nodes.map((n) => n.id)).toEqual(['d0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002'])
    expect(up.links).toEqual([{ from: up.nodes[1].id, to: up.nodes[0].id }])
    expect(up.nodes.map((n) => ({ ...n, id: '' }))).toEqual(old.nodes.map((n) => ({ ...n, id: '' })))
  })
})
