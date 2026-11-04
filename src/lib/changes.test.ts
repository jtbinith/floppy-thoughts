import { describe, expect, it } from 'vitest'
import { ME, type Board } from './board'
import { addLink, addUserNode, deleteNodes, editUserNode, removeLink, toggleFavourite, type OpResult } from './boardOps'
import { applyChange, changeBetween, isEmpty, onlyFavourites } from './changes'
import { createBoard } from './sparks/newBoard'

const ok = (r: OpResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.board
}

// Time, with three ideas linked in a chain: 1 – 2 – 3 – 4.
function start(): Board {
  let b = createBoard({ sparks: [{ text: 'Time', category: 'theme' }], name: 'time', id: 'b1' })
  for (const text of ['clocks', 'sundials', 'tides']) b = ok(addUserNode(b, text, { x: 0, y: 0 }))
  const id = (n: number) => b.nodes[n - 1].id
  for (const [a, c] of [[1, 2], [2, 3], [3, 4]]) b = ok(addLink(b, id(a), id(c)))
  return b
}
const idOf = (b: Board, n: number) => b.nodes.find((x) => x.number === n)!.id

describe('changeBetween', () => {
  it('sends only the box that was edited', () => {
    const a = start()
    const b = ok(editUserNode(a, idOf(a, 3), 'shadow clocks'))
    const c = changeBetween(a, b)
    expect(c.nodes.map((n) => n.text)).toEqual(['shadow clocks'])
    expect(c).toMatchObject({ boardId: 'b1', removedNodes: [], links: [], removedLinks: [] })
    expect(c).not.toHaveProperty('name')
  })

  it('sends a favourite as that one box', () => {
    const a = start()
    const c = changeBetween(a, ok(toggleFavourite(a, idOf(a, 2))))
    expect(c.nodes).toEqual([expect.objectContaining({ number: 2, favouritedBy: [ME] })])
  })

  it('sends new boxes and links, and removed ones', () => {
    const a = start()
    const withMoon = ok(addUserNode(a, 'moon', { x: 5, y: 5 }))
    const linked = ok(addLink(withMoon, idOf(withMoon, 1), idOf(withMoon, 5)))
    const c = changeBetween(a, linked)
    expect(c.nodes.map((n) => n.text)).toEqual(['moon'])
    expect(c.links).toEqual([{ from: idOf(a, 1), to: idOf(withMoon, 5) }])

    // Deleting the middle of the chain and keeping it connected: one box out, two links out, one in.
    const d = changeBetween(a, deleteNodes(a, [idOf(a, 3)], { reconnect: true }))
    expect(d.removedNodes).toEqual([idOf(a, 3)])
    expect(d.removedLinks).toHaveLength(2)
    expect(d.links).toEqual([{ from: idOf(a, 2), to: idOf(a, 4) }])
  })

  it('treats a link the other way round as the same link', () => {
    const a = start()
    const flipped = { ...a, links: a.links.map((l) => ({ from: l.to, to: l.from })) }
    expect(isEmpty(changeBetween(a, flipped))).toBe(true)
  })

  it("doesn't count a box rebuilt with the same values as a change", () => {
    const a = start()
    const rebuilt = { ...a, nodes: a.nodes.map((n) => Object.fromEntries(Object.entries(n).reverse()) as typeof n) }
    expect(isEmpty(changeBetween(a, rebuilt))).toBe(true)
  })

  it('sends the name only when it changed, and everything for a new board', () => {
    const a = start()
    expect(changeBetween(a, { ...a, name: 'tides' }).name).toBe('tides')
    const all = changeBetween(null, a)
    expect(all.name).toBe('time')
    expect(all.nodes).toHaveLength(4)
    expect(all.links).toHaveLength(3)
  })
})

describe('applyChange', () => {
  // Whatever happened, applying the change to the board before gives the board after.
  const steps: [string, (b: Board) => Board][] = [
    ['edit', (b) => ok(editUserNode(b, idOf(b, 2), 'water clocks'))],
    ['favourite', (b) => ok(toggleFavourite(b, idOf(b, 4)))],
    ['add', (b) => ok(addUserNode(b, 'moon', { x: 1, y: 2 }))],
    ['unlink', (b) => ok(removeLink(b, idOf(b, 2), idOf(b, 3)))],
    ['delete and reconnect', (b) => deleteNodes(b, [idOf(b, 3)], { reconnect: true })],
    ['delete the end', (b) => deleteNodes(b, [idOf(b, 4)])],
    ['rename', (b) => ({ ...b, name: 'tides and time' })],
  ]
  it.each(steps)('round-trips: %s', (_, step) => {
    const a = start()
    const b = step(a)
    expect(applyChange(a, changeBetween(a, b))).toEqual(b)
  })

  it("merges someone else's change into yours, box by box", () => {
    const base = start()
    const mine = ok(editUserNode(base, idOf(base, 2), 'water clocks'))
    const theirs = ok(editUserNode(base, idOf(base, 3), 'moon dials'))
    const merged = applyChange(mine, changeBetween(base, theirs))
    expect(merged.nodes.map((n) => n.text)).toEqual(['Time', 'water clocks', 'moon dials', 'tides'])
  })

  it('drops links to a box someone else deleted', () => {
    const base = start()
    const mine = ok(addLink(base, idOf(base, 1), idOf(base, 4)))
    const theirs = deleteNodes(base, [idOf(base, 4)])
    const merged = applyChange(mine, changeBetween(base, theirs))
    expect(merged.nodes).toHaveLength(3)
    expect(merged.links.every((l) => l.from !== idOf(base, 4) && l.to !== idOf(base, 4))).toBe(true)
  })
})

describe('onlyFavourites', () => {
  it('lets a favourite through, and nothing else', () => {
    const a = start()
    expect(onlyFavourites(a, changeBetween(a, ok(toggleFavourite(a, idOf(a, 2)))))).toBe(true)
    expect(onlyFavourites(a, changeBetween(a, ok(editUserNode(a, idOf(a, 2), 'nope'))))).toBe(false)
    expect(onlyFavourites(a, changeBetween(a, ok(addUserNode(a, 'nope', { x: 0, y: 0 }))))).toBe(false)
    expect(onlyFavourites(a, changeBetween(a, ok(removeLink(a, idOf(a, 1), idOf(a, 2)))))).toBe(false)
    expect(onlyFavourites(a, changeBetween(a, { ...a, name: 'nope' }))).toBe(false)
  })
})
