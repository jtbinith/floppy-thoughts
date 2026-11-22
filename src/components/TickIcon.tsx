// Chunky pixel-art tick and cross, drawn as rows of pixels (the bold staircase look of a pixel
// font): the tick's short stroke down, then its long stroke up; the cross as two thick diagonals.
// They use the current text colour.

type Spans = [row: number, from: number, to: number][]
const path = (spans: Spans) => spans.map(([y, a, b]) => `M${a} ${y}h${b - a + 1}v1H${a}z`).join(' ')

const TICK: Spans = [
  [0, 9, 11], [1, 8, 11], [2, 7, 10], [3, 6, 9], [4, 0, 1], [4, 5, 8],
  [5, 0, 2], [5, 4, 7], [6, 1, 6], [7, 2, 5], [8, 3, 4],
]
const CROSS: Spans = [
  [0, 0, 1], [0, 8, 9], [1, 0, 2], [1, 7, 9], [2, 1, 3], [2, 6, 8], [3, 2, 7], [4, 3, 6],
  [5, 3, 6], [6, 2, 7], [7, 1, 3], [7, 6, 8], [8, 0, 2], [8, 7, 9], [9, 0, 1], [9, 8, 9],
]

export function TickIcon({ size = 20 }: { size?: number }) {
  return (
    <svg className="tick-icon" width={size} height={(size * 9) / 12} viewBox="0 0 12 9" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d={path(TICK)} />
    </svg>
  )
}

export function CrossIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="cross-icon" width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d={path(CROSS)} />
    </svg>
  )
}
