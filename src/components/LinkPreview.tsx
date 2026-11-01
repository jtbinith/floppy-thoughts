import { useStore, type ConnectionLineComponentProps } from '@xyflow/react'
import { borderPoint, boxOf, contains } from './edgeGeometry'

// The line you see while dragging out a new link. It's the same straight, edge-to-edge line a
// finished link is, so what you see while dragging is what you get. Over a box, it snaps to that
// box and outlines it, because dropping anywhere on a box links to it.
export function LinkPreview({ fromNode, toX, toY }: ConnectionLineComponentProps) {
  const nodes = useStore((s) => s.nodeLookup)
  const from = boxOf(fromNode)
  let target = null
  for (const n of nodes.values()) {
    if (n.id === fromNode.id) continue
    const box = boxOf(n)
    if (contains(box, toX, toY)) target = box
  }

  if (target) {
    const start = borderPoint(from, target.cx, target.cy)
    const end = borderPoint(target, from.cx, from.cy)
    return (
      <g className="link-preview link-preview--snapped">
        <rect className="link-preview__target" x={target.x - 4} y={target.y - 4} width={target.w + 8} height={target.h + 8} rx={6} />
        <path className="react-flow__edge-path" d={`M ${start.x},${start.y} L ${end.x},${end.y}`} />
      </g>
    )
  }

  const start = borderPoint(from, toX, toY)
  return (
    <g className="link-preview">
      <path className="react-flow__edge-path" d={`M ${start.x},${start.y} L ${toX},${toY}`} />
      <circle className="link-preview__end" cx={toX} cy={toY} r={3} />
    </g>
  )
}
