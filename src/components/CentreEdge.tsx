import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react'
import { borderPoint, boxOf } from './edgeGeometry'

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
