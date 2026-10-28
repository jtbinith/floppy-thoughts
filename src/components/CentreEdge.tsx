import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react'

// Draws links centre to centre. Edges sit underneath nodes, so the line appears to run
// border to border whichever way the nodes are arranged (links are undirected).
export function CentreEdge({ id, source, target, style }: EdgeProps) {
  const from = useInternalNode(source)
  const to = useInternalNode(target)
  if (!from || !to) return null

  const centre = (n: typeof from) => ({
    x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
    y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
  })
  const a = centre(from)
  const b = centre(to)

  return <BaseEdge id={id} path={`M ${a.x},${a.y} L ${b.x},${b.y}`} style={style} />
}
