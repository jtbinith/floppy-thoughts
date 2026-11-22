import { describe, expect, it } from 'vitest'
import { frameFor, toBoard, toMap, viewOf } from './miniMap'

const boxes = [
  { x: 0, y: 0, width: 200, height: 80 },
  { x: 800, y: 400, width: 200, height: 80 },
]

describe('mini-map', () => {
  it('fits the boxes (with room around them) into the map, centred', () => {
    const f = frameFor(boxes, 200, 140)
    const all = boxes.map((b) => toMap(f, b))
    for (const b of all) {
      expect(b.x).toBeGreaterThan(0)
      expect(b.y).toBeGreaterThan(0)
      expect(b.x + b.width).toBeLessThan(200)
      expect(b.y + b.height).toBeLessThan(140)
    }
    // Centred: as much room on the left as on the right.
    expect(all[0].x).toBeCloseTo(200 - (all[1].x + all[1].width))
  })

  it("doesn't depend on where you're looking, so the view's box only changes size when you zoom", () => {
    const f = frameFor(boxes, 200, 140)
    const here = toMap(f, viewOf([0, 0, 1], 1000, 600))
    const moved = toMap(f, viewOf([-3000, -2000, 1], 1000, 600))
    expect(moved.width).toBeCloseTo(here.width)
    expect(moved.height).toBeCloseTo(here.height)
    const zoomedIn = toMap(f, viewOf([0, 0, 2], 1000, 600))
    expect(zoomedIn.width).toBeCloseTo(here.width / 2)
  })

  it('turns a spot on the map back into a spot on the board', () => {
    const f = frameFor(boxes, 200, 140)
    const m = toMap(f, { x: 500, y: 240, width: 0, height: 0 })
    const back = toBoard(f, m.x, m.y)
    expect(back.x).toBeCloseTo(500)
    expect(back.y).toBeCloseTo(240)
  })

  it('works on an empty board', () => {
    expect(frameFor([], 200, 140).scale).toBeGreaterThan(0)
  })
})
