// An original pixel-art shrimp, curled into a C like a fortune cookie: head at the top left,
// back on the right, fan tail at the bottom left. It's worked out on a small grid rather than
// drawn by hand, so the same shrimp can be made more or less curled, and can crack in half
// (head end and tail end) to let the note out, like a fortune cookie breaking open.

export type Shade = 'ink' | 'body' | 'shade' | 'light' | 'eye'
// Which half of the cracked shrimp a pixel belongs to.
export type Part = 'head' | 'tail'
export type Pixel = { x: number; y: number; shade: Shade; part: Part }

export const SHRIMP_GRID = { width: 36, height: 34 }

const CX = 21
const CY = 19
// The curl tightens towards the tail, like a real curled shrimp.
const radius = (t: number) => 8.6 - 3 * t

const rad = (deg: number) => (deg * Math.PI) / 180

// Where along the curl it cracks (0 is the head, 1 the tail).
const CRACK_AT = 0.47

// `gap` is how open the curl is, in degrees: small is curled shut, large is opened up.
// With `cracked`, each half gets its own outline, so the break shows as a jagged dark line.
export function shrimpPixels(gap: number, cracked = false): Pixel[] {
  const start = -(180 - gap)
  const end = 180 - gap
  const at = (t: number) => {
    const a = rad(start + t * (end - start))
    return { x: CX + radius(t) * Math.cos(a), y: CY + radius(t) * Math.sin(a), a }
  }
  const halfWidth = (t: number) => 3.3 - 2.2 * t

  const cells = new Map<string, { shade: Shade; part: Part }>()
  const key = (x: number, y: number) => `${x},${y}`
  const set = (x: number, y: number, shade: Shade, part: Part) => {
    if (x < 0 || y < 0 || x >= SHRIMP_GRID.width || y >= SHRIMP_GRID.height) return
    cells.set(key(x, y), { shade, part })
  }

  const head = at(0)
  // The head sits a little outside the curl, so it reads as a head rather than more body.
  const headX = head.x + Math.cos(head.a) * 0.8
  const headY = head.y + Math.sin(head.a) * 0.8 - 0.5
  const tail = at(1)
  // Direction the tail points: onward along the curl.
  const tailDir = rad(start + (end - start)) + Math.PI / 2

  for (let y = 0; y < SHRIMP_GRID.height; y++) {
    for (let x = 0; x < SHRIMP_GRID.width; x++) {
      const px = x + 0.5
      const py = y + 0.5
      // Body: close to the curl, thinner towards the tail.
      let best = Infinity
      let bestT = 0
      for (let i = 0; i <= 120; i++) {
        const p = at(i / 120)
        const d = Math.hypot(px - p.x, py - p.y)
        if (d < best) {
          best = d
          bestT = i / 120
        }
      }
      const inBody = best <= halfWidth(bestT)
      const inHead = Math.hypot(px - headX, py - headY) <= 4
      // Fan tail: a wedge pointing on from the end of the curl.
      const tx = px - tail.x
      const ty = py - tail.y
      const along = tx * Math.cos(tailDir) + ty * Math.sin(tailDir)
      const across = -tx * Math.sin(tailDir) + ty * Math.cos(tailDir)
      // Three prongs, like a fan.
      const prong = Math.abs(Math.abs(across) - along * 0.55) < 0.75 || Math.abs(across) < 0.75
      const inTail = along > -0.5 && along < 5.5 && Math.abs(across) < 0.9 + along * 0.6 && (along < 2.5 || prong)

      if (!inBody && !inHead && !inTail) continue
      const fromCentre = Math.hypot(px - CX, py - CY)
      let shade: Shade = 'body'
      if (inBody && !inHead) {
        // Shell bands across the body, and a darker inside of the curl.
        const band = (bestT * 7) % 1
        if (bestT > 0.12 && bestT < 0.92 && band < 0.14) shade = 'shade'
        else if (fromCentre < radius(bestT) - halfWidth(bestT) * 0.35) shade = 'shade'
        else if (fromCentre > radius(bestT) + halfWidth(bestT) * 0.45 && py < CY + 2) shade = 'light'
      }
      if (inTail && !inBody) shade = Math.abs(across) < 0.6 ? 'shade' : 'body'
      if (inHead && py < headY - 1.5) shade = 'light'
      // A jagged break across the body, a zig-zag rather than a clean cut.
      const zigzag = Math.floor(fromCentre * 1.5) % 2 ? 0.035 : -0.035
      const part: Part = inHead ? 'head' : inTail && !inBody ? 'tail' : bestT < CRACK_AT + zigzag ? 'head' : 'tail'
      set(x, y, shade, part)
    }
  }

  // An outline all the way round. Cracked, each half is outlined on its own, including along the break.
  const filled = [...cells.entries()]
  const outline = new Map<string, Part>()
  for (const [k, cell] of filled) {
    const [x, y] = k.split(',').map(Number)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = key(x + dx, y + dy)
      const other = cells.get(n)
      if (!other) outline.set(n, cell.part)
      else if (cracked && other.part !== cell.part) {
        // Along the break, both halves get a dark edge, so the crack shows.
        outline.set(k, cell.part)
      }
    }
  }
  for (const [k, part] of outline) {
    const [x, y] = k.split(',').map(Number)
    set(x, y, 'ink', part)
  }

  // Eye, near the front of the head.
  const front = head.a - Math.PI / 2
  const eyeX = Math.round(headX + Math.cos(front) * 1.4 - 0.5)
  const eyeY = Math.round(headY + Math.sin(front) * 1.4 - 1)
  set(eyeX, eyeY, 'eye', 'head')

  // Two long feelers: out from the face, then sweeping up and back.
  for (const [spread, length, turn] of [
    [0.1, 14, 0.13],
    [-0.3, 11, 0.16],
  ]) {
    let x = headX + Math.cos(front) * 3.5
    let y = headY + Math.sin(front) * 3.5
    let dir = front + spread
    for (let i = 0; i < length; i++) {
      x += Math.cos(dir)
      y += Math.sin(dir)
      dir += turn
      if (!cells.has(key(Math.floor(x), Math.floor(y)))) set(Math.floor(x), Math.floor(y), 'ink', 'head')
    }
  }

  // Little legs tucked inside the curl, under the head.
  for (const t of [0.1, 0.17, 0.24, 0.31]) {
    const p = at(t)
    const inward = p.a + Math.PI
    for (let i = 2; i <= 3; i++) {
      const x = Math.floor(p.x + Math.cos(inward) * (halfWidth(t) + i - 1))
      const y = Math.floor(p.y + Math.sin(inward) * (halfWidth(t) + i - 1))
      if (!cells.has(key(x, y))) set(x, y, 'ink', 'head')
    }
  }

  return [...cells.entries()].map(([k, { shade, part }]) => {
    const [x, y] = k.split(',').map(Number)
    return { x, y, shade, part }
  })
}
