import type { Board } from './board'

// Rough size of a box on screen, for placing things before React Flow has measured them.
// Good enough to stop new ideas landing on top of each other.
export const BOX = { width: 280, height: 105 }
const NODE_W = BOX.width
const NODE_H = BOX.height

// Where new things go, relative to the box they come from (as the centre of the new box).
export const PLACE = {
  // A linked idea (Tab): just below.
  branch: { x: BOX.width / 2, y: BOX.height * 2 + 10 },
  // A nudge: off to the right.
  nudge: { x: BOX.width + 150, y: BOX.height / 2 },
  // A note from the machine, beside what's selected.
  note: { x: BOX.width + 70, y: -BOX.height / 2 + 5 },
}

// The middle of a box whose top-left corner is at `at`.
export const centreOfBox = (at: { x: number; y: number }) => ({ x: at.x + BOX.width / 2, y: at.y + BOX.height / 2 })

export type Rect = { x: number; y: number; width: number; height: number }

// Finds the nearest empty spot to `target`, searching outwards in rings.
// With `within` (the part of the board you can see), it only picks spots that fit inside it,
// so new things don't land off screen. If there's no room there, it looks further out.
export function freeSpotNear(board: Board, target: { x: number; y: number }, within?: Rect): { x: number; y: number } {
  const overlaps = (x: number, y: number) =>
    board.nodes.some((n) => Math.abs(n.x - x) < NODE_W && Math.abs(n.y - y) < NODE_H)
  const visible = (x: number, y: number) =>
    !within || (x >= within.x && y >= within.y && x + NODE_W <= within.x + within.width && y + NODE_H <= within.y + within.height)

  const start = { x: target.x - NODE_W / 2, y: target.y - NODE_H / 2 }
  for (const needVisible of within ? [true, false] : [false]) {
    const ok = (x: number, y: number) => !overlaps(x, y) && (!needVisible || visible(x, y))
    if (ok(start.x, start.y)) return round(start)
    for (let ring = 1; ring <= 12; ring++) {
      const steps = ring * 8
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2
        const x = start.x + Math.cos(angle) * ring * NODE_W * 0.6
        const y = start.y + Math.sin(angle) * ring * NODE_H * 0.9
        if (ok(x, y)) return round({ x, y })
      }
    }
  }
  return round(start)
}

const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) })
