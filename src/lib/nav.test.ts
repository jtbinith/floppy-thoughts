import { describe, expect, it } from 'vitest'
import { nearestInDirection, nearestTo, type NavBox } from './nav'

const box = (id: string, x: number, y: number): NavBox => ({ id, x, y, width: 100, height: 50 })

//        up
//  left  mid  right   far-right
//        down
const boxes = [box('mid', 300, 300), box('left', 0, 300), box('right', 600, 310), box('far-right', 1200, 300), box('up', 300, 0), box('down', 320, 600)]

describe('nearestInDirection', () => {
  it('finds the nearest box each way', () => {
    expect(nearestInDirection(boxes, 'mid', 'left')).toBe('left')
    expect(nearestInDirection(boxes, 'mid', 'right')).toBe('right')
    expect(nearestInDirection(boxes, 'mid', 'up')).toBe('up')
    expect(nearestInDirection(boxes, 'mid', 'down')).toBe('down')
  })

  it('keeps going along a row', () => {
    expect(nearestInDirection(boxes, 'right', 'right')).toBe('far-right')
  })

  it('prefers one roughly in line over a closer one far off to the side', () => {
    const row = [box('a', 0, 0), box('in-line', 500, 20), box('off-side', 150, 400)]
    expect(nearestInDirection(row, 'a', 'right')).toBe('in-line')
  })

  it('says null at the edge', () => {
    expect(nearestInDirection(boxes, 'far-right', 'right')).toBeNull()
    expect(nearestInDirection(boxes, 'nope', 'left')).toBeNull()
  })
})

describe('nearestTo', () => {
  it('picks the box nearest a point', () => {
    expect(nearestTo(boxes, { x: 640, y: 330 })).toBe('right')
    expect(nearestTo([], { x: 0, y: 0 })).toBeNull()
  })
})
