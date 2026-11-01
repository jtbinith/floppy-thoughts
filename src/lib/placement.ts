import type { Board } from './board'

// Rough size of a node on screen. Good enough to stop new ideas landing on top of each other.
const NODE_W = 230
const NODE_H = 90

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
