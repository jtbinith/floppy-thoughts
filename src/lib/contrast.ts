// Colour contrast, as in the Web Content Accessibility Guidelines (WCAG 2.2).

// How bright a colour looks to the eye, from 0 (black) to 1 (white).
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

// From 1 (no contrast) to 21 (black on white).
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// AAA and AA are the passes for normal text; "large" passes only for big or bold text (and icons).
export type Rating = 'AAA' | 'AA' | 'large' | 'fail'
export function rate(ratio: number): Rating {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'large'
  return 'fail'
}

// Whichever of the candidates reads best on this background.
export const bestText = (bg: string, candidates: string[]) =>
  candidates.reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best))
