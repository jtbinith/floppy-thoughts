import type { BoardSummary } from '../lib/storage'

// A tiny map of a board: its boxes and links, scaled to fit.
const W = 160
const H = 100
const PAD = 12

export function BoardSketch({ sketch }: { sketch: BoardSummary['sketch'] }) {
  const at = ([x, y]: [number, number, ...unknown[]]) => [PAD + x * (W - 2 * PAD), PAD + y * (H - 2 * PAD)]
  const points = sketch.nodes.map(at)
  return (
    <svg className="sketch" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {sketch.nodes.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle">
          empty
        </text>
      )}
      {sketch.links.map(([a, b], i) => (
        <line key={i} x1={points[a][0]} y1={points[a][1]} x2={points[b][0]} y2={points[b][1]} />
      ))}
      {sketch.nodes.map(([, , tone], i) => (
        <rect key={i} className={`sketch__${tone}`} x={points[i][0] - 5} y={points[i][1] - 3} width={10} height={6} />
      ))}
    </svg>
  )
}
