// Moving around the board from the keyboard (h j k l, or the arrows): which box is next in a
// direction. It looks for the nearest box whose middle is that way, preferring ones roughly in
// line over ones far off to the side, like moving between windows in a tiling window manager.

export type NavBox = { id: string; x: number; y: number; width: number; height: number }
export type Direction = 'left' | 'right' | 'up' | 'down'

const centre = (b: NavBox) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

export function nearestInDirection(boxes: readonly NavBox[], fromId: string, direction: Direction): string | null {
  const from = boxes.find((b) => b.id === fromId)
  if (!from) return null
  const a = centre(from)
  let best: { id: string; score: number; inLine: boolean } | null = null
  for (const b of boxes) {
    if (b.id === fromId) continue
    const c = centre(b)
    const dx = c.x - a.x
    const dy = c.y - a.y
    // How far it is the way you're going, and how far off to the side.
    const ahead = { left: -dx, right: dx, up: -dy, down: dy }[direction]
    const aside = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
    if (ahead <= 1) continue
    // Within a wide cone counts as "that way"; outside it only if nothing is.
    const inLine = aside <= ahead * 2
    const score = ahead + aside * 2
    if (!best || (inLine && !best.inLine) || (inLine === best.inLine && score < best.score)) best = { id: b.id, score, inLine }
  }
  return best?.id ?? null
}

// Where to start when nothing is selected: the box nearest the middle of what you can see.
export function nearestTo(boxes: readonly NavBox[], point: { x: number; y: number }): string | null {
  let best: { id: string; d: number } | null = null
  for (const b of boxes) {
    const c = centre(b)
    const d = Math.hypot(c.x - point.x, c.y - point.y)
    if (!best || d < best.d) best = { id: b.id, d }
  }
  return best?.id ?? null
}
