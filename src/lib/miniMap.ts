// The board's mini-map maths. The map is fitted to the boxes on the board (not to where you're
// looking), so as you move around it stays still and the box for the view only changes size when
// you zoom. It only rescales when boxes are added further out.

export type Rect = { x: number; y: number; width: number; height: number }
// How board positions map onto the mini-map: map = (board - origin) * scale.
export type Frame = { scale: number; originX: number; originY: number }

// Room around the boxes, as a share of the board's size (and at least this many board pixels).
const PAD = 0.12
const MIN_PAD = 120

export function frameFor(boxes: Rect[], mapWidth: number, mapHeight: number): Frame {
  if (!boxes.length) return { scale: mapWidth / 1000, originX: -500, originY: -(500 * mapHeight) / mapWidth }
  const left = Math.min(...boxes.map((b) => b.x))
  const top = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  const padX = Math.max(MIN_PAD, (right - left) * PAD)
  const padY = Math.max(MIN_PAD, (bottom - top) * PAD)
  const [w, h] = [right - left + padX * 2, bottom - top + padY * 2]
  const scale = Math.min(mapWidth / w, mapHeight / h)
  // Centred in the map, whichever way there's room to spare.
  return { scale, originX: (left + right) / 2 - mapWidth / scale / 2, originY: (top + bottom) / 2 - mapHeight / scale / 2 }
}

export const toMap = (f: Frame, r: Rect): Rect => ({ x: (r.x - f.originX) * f.scale, y: (r.y - f.originY) * f.scale, width: r.width * f.scale, height: r.height * f.scale })
export const toBoard = (f: Frame, x: number, y: number) => ({ x: x / f.scale + f.originX, y: y / f.scale + f.originY })

// The part of the board on screen, from React Flow's transform ([x, y, zoom]) and the board's size.
export const viewOf = ([tx, ty, zoom]: [number, number, number], width: number, height: number): Rect => ({ x: -tx / zoom, y: -ty / zoom, width: width / zoom, height: height / zoom })
