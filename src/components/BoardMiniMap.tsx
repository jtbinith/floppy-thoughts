import { useRef } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { BOX } from '../lib/placement'
import { frameFor, toBoard, toMap, viewOf, type Rect } from '../lib/miniMap'
import type { IdeaFlowNode } from '../lib/flow'

// The board's mini-map: every box in its note colour, and a box for the part of the board on
// screen. The map is fitted to the boxes (see lib/miniMap), so it holds still as you move around
// and the box only changes size when you zoom. Drag the box to slide the view; click or tap
// anywhere else on the map to jump there (and keep dragging from there).
export function BoardMiniMap({ width, height }: { width: number; height: number }) {
  const { setViewport, getViewport } = useReactFlow<IdeaFlowNode>()
  const nodes = useStore((s) => s.nodes) as IdeaFlowNode[]
  const transform = useStore((s) => s.transform)
  const paneWidth = useStore((s) => s.width)
  const paneHeight = useStore((s) => s.height)
  const dragging = useRef<{ id: number; x: number; y: number } | null>(null)

  const boxes = nodes.map((n) => ({ n, r: { x: n.position.x, y: n.position.y, width: n.measured?.width ?? BOX.width, height: n.measured?.height ?? BOX.height } as Rect }))
  const frame = frameFor(
    boxes.map((b) => b.r),
    width,
    height,
  )
  const view = toMap(frame, viewOf(transform, paneWidth, paneHeight))

  // Centre the view on a spot on the map.
  const centreOn = (mx: number, my: number) => {
    const { zoom } = getViewport()
    const at = toBoard(frame, mx, my)
    void setViewport({ x: paneWidth / 2 - at.x * zoom, y: paneHeight / 2 - at.y * zoom, zoom })
  }
  const spot = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <svg
      className="board-map"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Mini-map of the board"
      onPointerDown={(e) => {
        e.preventDefault()
        const at = spot(e)
        const inView = at.x >= view.x && at.x <= view.x + view.width && at.y >= view.y && at.y <= view.y + view.height
        if (!inView) centreOn(at.x, at.y)
        e.currentTarget.setPointerCapture(e.pointerId)
        dragging.current = { id: e.pointerId, ...at }
      }}
      onPointerMove={(e) => {
        const d = dragging.current
        if (!d || d.id !== e.pointerId) return
        const at = spot(e)
        const { x, y, zoom } = getViewport()
        // Moving the box on the map by one map pixel moves the board under it by 1/scale.
        void setViewport({ x: x - ((at.x - d.x) / frame.scale) * zoom, y: y - ((at.y - d.y) / frame.scale) * zoom, zoom })
        dragging.current = { id: d.id, ...at }
      }}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
    >
      {boxes.map(({ n, r }) => {
        const m = toMap(frame, r)
        return <rect key={n.id} className={`board-map__box board-map__box--${n.data.category ?? n.data.kind}`} x={m.x} y={m.y} width={Math.max(2, m.width)} height={Math.max(2, m.height)} rx={1.5} />
      })}
      {/* Everything but the part on screen, dimmed; then its outline. */}
      <path className="board-map__dim" fillRule="evenodd" d={`M0 0h${width}v${height}H0z M${view.x} ${view.y}h${view.width}v${view.height}h${-view.width}z`} />
      <rect className="board-map__view" x={view.x} y={view.y} width={view.width} height={view.height} />
    </svg>
  )
}
