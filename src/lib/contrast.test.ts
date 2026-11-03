import { describe, expect, it } from 'vitest'
import { bestText, contrast, luminance, rate } from './contrast'

describe('colour contrast', () => {
  it('matches the known extremes', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1)
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1)
  })

  it('is the same either way round', () => {
    expect(contrast('#ff7a52', '#17110e')).toBeCloseTo(contrast('#17110e', '#ff7a52'))
  })

  it('matches a known pair (grey #767676 on white is just over 4.5)', () => {
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 1)
  })

  it('rates ratios against the WCAG thresholds', () => {
    expect(rate(7.1)).toBe('AAA')
    expect(rate(4.5)).toBe('AA')
    expect(rate(3.2)).toBe('large')
    expect(rate(2.9)).toBe('fail')
  })

  it('picks the more readable text colour', () => {
    expect(bestText('#fce4b4', ['#f6e3cc', '#17110e'])).toBe('#17110e')
    expect(bestText('#17110e', ['#f6e3cc', '#17110e'])).toBe('#f6e3cc')
  })
})
