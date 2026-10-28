import type { Board } from './board'

// Rough size of a node on screen. Good enough to stop new ideas landing on top of each other.
const NODE_W = 230
const NODE_H = 90

// Finds the nearest empty spot to `target`, searching outwards in rings.
export function freeSpotNear(board: Board, target: { x: number; y: number }): { x: number; y: number } {
  const overlaps = (x: number, y: number) =>
    board.nodes.some((n) => Math.abs(n.x - x) < NODE_W && Math.abs(n.y - y) < NODE_H)

  const start = { x: target.x - NODE_W / 2, y: target.y - NODE_H / 2 }
  if (!overlaps(start.x, start.y)) return round(start)

  for (let ring = 1; ring <= 12; ring++) {
    const steps = ring * 8
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const x = start.x + Math.cos(angle) * ring * NODE_W * 0.6
      const y = start.y + Math.sin(angle) * ring * NODE_H * 0.9
      if (!overlaps(x, y)) return round({ x, y })
    }
  }
  return round(start)
}

const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) })
