import { BaseEdge, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react'

type Box = { cx: number; cy: number; w: number; h: number }

const boxOf = (n: InternalNode): Box => {
  const w = n.measured.width ?? 0
  const h = n.measured.height ?? 0
  return { cx: n.internals.positionAbsolute.x + w / 2, cy: n.internals.positionAbsolute.y + h / 2, w, h }
}

// Where the line from this box's centre towards (tx, ty) leaves the box.
function borderPoint(box: Box, tx: number, ty: number) {
  const dx = tx - box.cx
  const dy = ty - box.cy
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy }
  const scale = Math.min(dx ? box.w / 2 / Math.abs(dx) : Infinity, dy ? box.h / 2 / Math.abs(dy) : Infinity)
  return { x: box.cx + dx * scale, y: box.cy + dy * scale }
}

// Links run between the edges of the two boxes, never through them, so see-through boxes stay clean.
// Links are undirected, so it doesn't matter which end is the source.
export function CentreEdge({ id, source, target, style }: EdgeProps) {
  const from = useInternalNode(source)
  const to = useInternalNode(target)
  if (!from || !to) return null

  const a = boxOf(from)
  const b = boxOf(to)
  const start = borderPoint(a, b.cx, b.cy)
  const end = borderPoint(b, a.cx, a.cy)

  return <BaseEdge id={id} path={`M ${start.x},${start.y} L ${end.x},${end.y}`} style={style} />
}
