import { describe, expect, it } from 'vitest'
import { SHRIMP_GRID, shrimpPixels } from './shrimpPixels'

describe('pixel shrimp', () => {
  it('stays on its grid, with one eye and an outline', () => {
    for (const gap of [32, 50, 70]) {
      const pixels = shrimpPixels(gap)
      expect(pixels.length).toBeGreaterThan(150)
      for (const p of pixels) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThan(SHRIMP_GRID.width)
        expect(p.y).toBeLessThan(SHRIMP_GRID.height)
      }
      expect(pixels.filter((p) => p.shade === 'eye')).toHaveLength(1)
      expect(pixels.some((p) => p.shade === 'ink')).toBe(true)
    }
  })

  it('opens up between frames', () => {
    const key = (gap: number) => new Set(shrimpPixels(gap).map((p) => `${p.x},${p.y}`))
    expect(key(32)).not.toEqual(key(70))
  })
})

describe('cracked shrimp', () => {
  it('splits into a head half and a tail half, each with its own edge along the break', () => {
    const pixels = shrimpPixels(40, true)
    const head = pixels.filter((p) => p.part === 'head')
    const tail = pixels.filter((p) => p.part === 'tail')
    expect(head.length).toBeGreaterThan(60)
    expect(tail.length).toBeGreaterThan(40)
    expect(head.some((p) => p.shade === 'eye')).toBe(true)
    // Cracking adds dark edge pixels where the halves meet.
    const ink = (px: typeof pixels) => px.filter((p) => p.shade === 'ink').length
    expect(ink(pixels)).toBeGreaterThan(ink(shrimpPixels(40)))
  })
})
