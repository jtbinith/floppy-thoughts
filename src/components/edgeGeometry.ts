import type { InternalNode } from '@xyflow/react'

// Shared by links and the line you drag while making one, so both look the same.

export type Box = { x: number; y: number; cx: number; cy: number; w: number; h: number }

export const boxOf = (n: InternalNode): Box => {
  const w = n.measured.width ?? 0
  const h = n.measured.height ?? 0
  const { x, y } = n.internals.positionAbsolute
  return { x, y, cx: x + w / 2, cy: y + h / 2, w, h }
}

export const contains = (box: Box, px: number, py: number) => px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h

// Where the line from this box's centre towards (tx, ty) leaves the box.
export function borderPoint(box: Box, tx: number, ty: number) {
  const dx = tx - box.cx
  const dy = ty - box.cy
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy }
  const scale = Math.min(dx ? box.w / 2 / Math.abs(dx) : Infinity, dy ? box.h / 2 / Math.abs(dy) : Infinity)
  return { x: box.cx + dx * scale, y: box.cy + dy * scale }
}
