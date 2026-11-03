import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import type { Board } from './board'
import { mainTheme } from './boardOps'
import { BOX } from './placement'

// "Tidy": groups of linked thoughts each get their own space, laid out so links are short and
// cross as little as possible, and the groups sit side by side with room between them, the way
// you'd arrange them by hand. The first theme stays where it is. Only runs when you ask.

export type Size = { width: number; height: number }
type Point = { x: number; y: number }
type Body = SimulationNodeDatum & { id: string; w: number; h: number }

// Rough size for boxes that haven't been measured yet.
const FALLBACK: Size = BOX
const GAP = 36
const GROUP_GAP = 140
// How many starting arrangements to try per group; the one with the fewest crossings wins.
const ATTEMPTS = 8

export function tidyPositions(board: Board, sizes: ReadonlyMap<string, Size> = new Map()): { id: string; x: number; y: number }[] {
  if (board.nodes.length < 2) return board.nodes.map(({ id, x, y }) => ({ id, x, y }))
  const size = (id: string) => sizes.get(id) ?? FALLBACK
  const neighbours = new Map<string, string[]>(board.nodes.map((n) => [n.id, []]))
  for (const l of board.links) {
    neighbours.get(l.from)?.push(l.to)
    neighbours.get(l.to)?.push(l.from)
  }
  const anchor = mainTheme(board)

  // Each group laid out on its own, as centres relative to the group.
  const groups = connectedGroups(board.nodes.map((n) => n.id), neighbours).map((ids) => {
    const root = anchor && ids.includes(anchor.id) ? anchor.id : ids.reduce((a, b) => (neighbours.get(b)!.length > neighbours.get(a)!.length ? b : a))
    return { ids, root, centres: layoutGroup(ids, root, neighbours, size) }
  })

  // The theme's group first, then bigger groups; single loose boxes go last, together.
  groups.sort((a, b) => Number(b.ids.includes(anchor?.id ?? '')) - Number(a.ids.includes(anchor?.id ?? '')) || b.ids.length - a.ids.length)
  const placed = packGroups(groups, size)

  // Shift everything so the first theme (or, without one, the board's middle) doesn't move.
  const before = centreOfMass(board.nodes.map((n) => ({ x: n.x + size(n.id).width / 2, y: n.y + size(n.id).height / 2 })))
  const pin = anchor ? { x: anchor.x + size(anchor.id).width / 2, y: anchor.y + size(anchor.id).height / 2 } : before
  const pinned = anchor ? placed.get(anchor.id)! : centreOfMass([...placed.values()])
  const dx = pin.x - pinned.x
  const dy = pin.y - pinned.y

  return board.nodes.map((n) => {
    const c = placed.get(n.id)!
    const { width, height } = size(n.id)
    return { id: n.id, x: Math.round(c.x + dx - width / 2), y: Math.round(c.y + dy - height / 2) }
  })
}

function connectedGroups(ids: string[], neighbours: Map<string, string[]>): string[][] {
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const start of ids) {
    if (seen.has(start)) continue
    const group: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length) {
      const id = queue.shift()!
      group.push(id)
      for (const next of neighbours.get(id) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    groups.push(group)
  }
  return groups
}

// Lays out one group from a clean, tree-like start (so old tangles aren't kept), a few times
// with different turns, and keeps the arrangement with the fewest crossing links.
function layoutGroup(ids: string[], root: string, neighbours: Map<string, string[]>, size: (id: string) => Size): Map<string, Point> {
  if (ids.length === 1) return new Map([[ids[0], { x: 0, y: 0 }]])
  const links = ids.flatMap((a) => (neighbours.get(a) ?? []).filter((b) => a < b).map((b) => [a, b] as const))
  let best: { centres: Map<string, Point>; score: number } | null = null

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const start = radialStart(ids, root, neighbours, attempt)
    const bodies: Body[] = ids.map((id) => ({ id, w: size(id).width, h: size(id).height, ...start.get(id)! }))
    const simulation = forceSimulation(bodies)
      .force(
        'link',
        forceLink<Body, SimulationLinkDatum<Body>>(links.map(([source, target]) => ({ source, target })))
          .id((b) => b.id)
          .distance((l) => {
            const a = l.source as Body
            const b = l.target as Body
            return (Math.max(a.w, a.h * 2) + Math.max(b.w, b.h * 2)) / 2 + 50
          })
          .strength(0.9),
      )
      .force('charge', forceManyBody().strength(-900))
      .force('collide', forceCollide<Body>((b) => Math.hypot(b.w, b.h) / 2 + GAP / 2).strength(1).iterations(3))
      .force('x', forceX(0).strength(0.03))
      .force('y', forceY(0).strength(0.05))
      .stop()
    for (let i = 0; i < 400; i++) simulation.tick()
    removeOverlaps(bodies)

    const centres = new Map(bodies.map((b) => [b.id, { x: b.x!, y: b.y! }]))
    // Fewest crossings first; among equals, the shortest links.
    const score = crossings(links, centres) * 1e6 + totalLength(links, centres)
    if (!best || score < best.score) best = { centres, score }
  }
  return best!.centres
}

// A tree-ish starting point: the root in the middle, its links in a ring around it, and so on
// outwards, each branch getting a slice of the circle. `turn` rotates it for each attempt.
function radialStart(ids: string[], root: string, neighbours: Map<string, string[]>, turn: number): Map<string, Point> {
  const parent = new Map<string, string | null>([[root, null]])
  const children = new Map<string, string[]>(ids.map((id) => [id, []]))
  const depth = new Map<string, number>([[root, 0]])
  const queue = [root]
  while (queue.length) {
    const id = queue.shift()!
    for (const next of neighbours.get(id) ?? []) {
      if (parent.has(next)) continue
      parent.set(next, id)
      depth.set(next, depth.get(id)! + 1)
      children.get(id)!.push(next)
      queue.push(next)
    }
  }
  const leaves = (id: string): number => {
    const kids = children.get(id)!
    return kids.length ? kids.reduce((s, k) => s + leaves(k), 0) : 1
  }
  const at = new Map<string, Point>()
  const place = (id: string, from: number, to: number) => {
    const d = depth.get(id)!
    const angle = (from + to) / 2
    at.set(id, { x: Math.cos(angle) * d * 260, y: Math.sin(angle) * d * 180 })
    let cursor = from
    for (const kid of children.get(id)!) {
      const share = ((to - from) * leaves(kid)) / leaves(id)
      place(kid, cursor, cursor + share)
      cursor += share
    }
  }
  const offset = (turn / ATTEMPTS) * Math.PI * 2
  place(root, offset, offset + Math.PI * 2)
  return at
}

// Places groups in rows, left to right, wrapping so the whole board stays roughly landscape.
function packGroups(groups: { ids: string[]; centres: Map<string, Point> }[], size: (id: string) => Size): Map<string, Point> {
  const boxes = groups.map((g) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of g.ids) {
      const c = g.centres.get(id)!
      const { width, height } = size(id)
      minX = Math.min(minX, c.x - width / 2)
      minY = Math.min(minY, c.y - height / 2)
      maxX = Math.max(maxX, c.x + width / 2)
      maxY = Math.max(maxY, c.y + height / 2)
    }
    return { g, minX, minY, w: maxX - minX, h: maxY - minY }
  })
  const totalArea = boxes.reduce((s, b) => s + (b.w + GROUP_GAP) * (b.h + GROUP_GAP), 0)
  const rowWidth = Math.max(Math.sqrt(totalArea) * 1.6, ...boxes.map((b) => b.w))

  const placed = new Map<string, Point>()
  let x = 0
  let y = 0
  let rowHeight = 0
  for (const b of boxes) {
    if (x > 0 && x + b.w > rowWidth) {
      x = 0
      y += rowHeight + GROUP_GAP
      rowHeight = 0
    }
    for (const id of b.g.ids) {
      const c = b.g.centres.get(id)!
      placed.set(id, { x: x + (c.x - b.minX), y: y + (c.y - b.minY) })
    }
    x += b.w + GROUP_GAP
    rowHeight = Math.max(rowHeight, b.h)
  }
  return placed
}

function crossings(links: readonly (readonly [string, string])[], at: Map<string, Point>): number {
  let count = 0
  for (let i = 0; i < links.length; i++)
    for (let j = i + 1; j < links.length; j++) {
      const [a, b] = links[i]
      const [c, d] = links[j]
      if (a === c || a === d || b === c || b === d) continue
      if (segmentsCross(at.get(a)!, at.get(b)!, at.get(c)!, at.get(d)!)) count++
    }
  return count
}

function segmentsCross(p: Point, q: Point, r: Point, s: Point): boolean {
  const turn = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
  return turn(p, q, r) !== turn(p, q, s) && turn(r, s, p) !== turn(r, s, q)
}

const totalLength = (links: readonly (readonly [string, string])[], at: Map<string, Point>) =>
  links.reduce((s, [a, b]) => s + Math.hypot(at.get(a)!.x - at.get(b)!.x, at.get(a)!.y - at.get(b)!.y), 0)

const centreOfMass = (points: Point[]): Point => ({
  x: points.reduce((s, p) => s + p.x, 0) / points.length,
  y: points.reduce((s, p) => s + p.y, 0) / points.length,
})

// Circles can still leave box corners touching, so finish by pushing any overlapping boxes apart.
function removeOverlaps(bodies: Body[]) {
  for (let pass = 0; pass < 60; pass++) {
    let moved = false
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]
        const dx = b.x! - a.x!
        const dy = b.y! - a.y!
        const overlapX = (a.w + b.w) / 2 + GAP - Math.abs(dx)
        const overlapY = (a.h + b.h) / 2 + GAP - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue
        moved = true
        if (overlapX < overlapY) {
          const push = (overlapX / 2) * Math.sign(dx || 1)
          a.x! -= push
          b.x! += push
        } else {
          const push = (overlapY / 2) * Math.sign(dy || 1)
          a.y! -= push
          b.y! += push
        }
      }
    }
    if (!moved) return
  }
}
