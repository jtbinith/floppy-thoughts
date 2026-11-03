import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { tidyPositions } from './tidy'

// Everything piled on top of everything else, the worst case.
const pile: Board = {
  version: 3,
  id: 'b',
  name: 'pile',
  nodes: [
    { id: 'n1', number: 1, text: 'Time', kind: 'spark', category: 'theme', locked: true, x: 100, y: 100 },
    ...Array.from({ length: 9 }, (_, i) => ({ id: `n${i + 2}`, number: i + 2, text: `idea ${i}`, kind: 'user' as const, x: 100 + i, y: 100 + i })),
  ],
  links: [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n1', to: 'n4' },
  ],
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
}

describe('tidy', () => {
  const out = tidyPositions(pile)
  const at = new Map(out.map((p) => [p.id, p]))

  it('leaves no boxes overlapping', () => {
    for (const a of out)
      for (const b of out) {
        if (a.id >= b.id) continue
        const apart = Math.abs(a.x - b.x) >= 230 || Math.abs(a.y - b.y) >= 90
        expect(apart, `${a.id} and ${b.id}`).toBe(true)
      }
  })

  it('keeps the first theme where it was', () => {
    expect(at.get('n1')).toEqual({ id: 'n1', x: 100, y: 100 })
  })

  it('keeps linked things closer than unlinked ones, on average', () => {
    const d = (a: string, b: string) => Math.hypot(at.get(a)!.x - at.get(b)!.x, at.get(a)!.y - at.get(b)!.y)
    expect(d('n1', 'n2')).toBeLessThan(d('n1', 'n9') + 1)
  })

  it('does nothing to a board with one box', () => {
    expect(tidyPositions({ ...pile, nodes: pile.nodes.slice(0, 1), links: [] })).toEqual([{ id: 'n1', x: 100, y: 100 }])
  })
})

describe('tidy on the screencast board', () => {
  // greetings + hello/ciao/bye/goodbye, a separate food group, and adios on its own.
  const idea = (id: string, text: string, i: number) => ({ id, number: Number(id.slice(1)), text, kind: 'user' as const, x: (i * 37) % 300, y: (i * 53) % 200 })
  const board: Board = {
    ...pile,
    nodes: [
      { id: 'n1', number: 1, text: 'greetings', kind: 'spark', category: 'theme', locked: true, x: 400, y: 100 },
      idea('n2', 'hello', 1),
      idea('n3', 'ciao', 2),
      idea('n4', 'bye', 3),
      idea('n5', 'goodbye', 4),
      idea('n6', 'adios', 5),
      idea('n7', 'nachos', 6),
      idea('n8', 'food', 7),
      idea('n9', 'salsa', 8),
      idea('n10', 'mexico', 9),
    ],
    links: [
      { from: 'n1', to: 'n2' },
      { from: 'n1', to: 'n3' },
      { from: 'n3', to: 'n5' },
      { from: 'n5', to: 'n4' },
      { from: 'n4', to: 'n2' },
      { from: 'n3', to: 'n4' },
      { from: 'n7', to: 'n9' },
      { from: 'n9', to: 'n8' },
      { from: 'n8', to: 'n10' },
      { from: 'n9', to: 'n10' },
    ],
  }
  const out = new Map(tidyPositions(board).map((p) => [p.id, p]))
  const box = (ids: string[]) => {
    const ps = ids.map((id) => out.get(id)!)
    return { x1: Math.min(...ps.map((p) => p.x)), y1: Math.min(...ps.map((p) => p.y)), x2: Math.max(...ps.map((p) => p.x + 230)), y2: Math.max(...ps.map((p) => p.y + 90)) }
  }

  it('gives each group its own space', () => {
    const greetings = box(['n1', 'n2', 'n3', 'n4', 'n5'])
    const food = box(['n7', 'n8', 'n9', 'n10'])
    const apart = greetings.x2 <= food.x1 || food.x2 <= greetings.x1 || greetings.y2 <= food.y1 || food.y2 <= greetings.y1
    expect(apart).toBe(true)
  })

  it('keeps the theme still', () => {
    expect(out.get('n1')).toMatchObject({ x: 400, y: 100 })
  })

  it('leaves no links crossing', () => {
    const centre = (id: string) => ({ x: out.get(id)!.x + 115, y: out.get(id)!.y + 45 })
    const turn = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
      Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
    let crossing = 0
    for (const [i, l] of board.links.entries())
      for (const m of board.links.slice(i + 1)) {
        if ([l.from, l.to].some((id) => id === m.from || id === m.to)) continue
        const [p, q, r, s] = [centre(l.from), centre(l.to), centre(m.from), centre(m.to)]
        if (turn(p, q, r) !== turn(p, q, s) && turn(r, s, p) !== turn(r, s, q)) crossing++
      }
    expect(crossing).toBe(0)
  })
})
