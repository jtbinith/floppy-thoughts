import type { RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Board } from '../../lib/board'
import { findNode, moveNodes } from '../../lib/boardOps'
import { BOX, centreOfBox, freeSpotNear, placeFor, type Rect } from '../../lib/placement'
import { usePhone } from '../../lib/usePhone'
import { tidyPositions } from '../../lib/tidy'

// Where things go on the board's screen: the part you can see, free spots near something,
// gliding over to a box, tidying the layout, and where a note from the machine will land.
export function useBoardView({
  board,
  boardRef,
  latest,
  commit,
}: {
  board: Board
  boardRef: RefObject<HTMLDivElement | null>
  latest: RefObject<Board>
  commit: (previous: Board, next: Board) => void
}) {
  const { screenToFlowPosition, flowToScreenPosition, getNodes, setNodes, setCenter, getZoom, getViewport, setViewport } = useReactFlow()

  // The part of the board you can see, in board coordinates, so new things land on screen.
  function viewRect(): Rect | undefined {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return undefined
    const margin = 24
    // On a phone the bottom of the board can be under the selected box's bar, so keep clear of it.
    const bottom = phone ? 84 : margin
    const topLeft = screenToFlowPosition({ x: rect.left + margin, y: rect.top + margin })
    const bottomRight = screenToFlowPosition({ x: rect.right - margin, y: rect.bottom - bottom })
    return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y }
  }

  // Somewhere free near `target`, on screen if there's room.
  const phone = usePhone()
  const spotNear = (on: Board, target: { x: number; y: number }) => freeSpotNear(on, target, viewRect(), phone)

  // The nearest free spot to the middle of the visible board.
  function centreOf(on: Board) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return freeSpotNear(on, { x: 0, y: 0 })
    // On a phone new ideas start near the top of the view and stack downwards (see spotNear), so
    // several fit on screen; elsewhere they start in the middle.
    // On a phone they also line up down the left, so the column doesn't wander as the view moves.
    // With boxes already in view, the next one goes under the lowest of them, so they read top to
    // bottom in the order you added them.
    if (phone) {
      const zoom = getZoom()
      const top = screenToFlowPosition({ x: rect.left + 24, y: rect.top + 24 })
      const view = viewRect()
      const inView = view ? on.nodes.filter((n) => n.y + BOX.height > view.y && n.y < view.y + view.height) : []
      const lowest = inView.length ? Math.max(...inView.map((n) => n.y)) : null
      const y = lowest === null ? top.y + BOX.height / 2 + 30 / zoom : lowest + BOX.height / 2 + BOX.height * 1.2
      return spotNear(on, { x: top.x + BOX.width / 2, y })
    }
    return spotNear(on, screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }))
  }

  // If something landed off screen anyway (the view was full), glide over to it.
  function reveal(at: { x: number; y: number }) {
    const view = viewRect()
    if (!view) return
    const inside = at.x >= view.x && at.y >= view.y && at.x + BOX.width <= view.x + view.width && at.y + BOX.height <= view.y + view.height
    if (inside) return
    if (phone) {
      // Just far enough to bring it in at the nearest edge (with a little room), so the boxes it
      // was added after stay on screen too. Centring on it would push them out of a phone's view.
      const room = 24 / getZoom()
      const dx = at.x < view.x ? at.x - view.x - room : at.x + BOX.width > view.x + view.width ? at.x + BOX.width - (view.x + view.width) + room : 0
      const dy = at.y < view.y ? at.y - view.y - room : at.y + BOX.height > view.y + view.height ? at.y + BOX.height - (view.y + view.height) + room : 0
      const { x, y, zoom } = getViewport()
      void setViewport({ x: x - dx * zoom, y: y - dy * zoom, zoom }, { duration: 350 })
      return
    }
    const centre = centreOfBox(at)
    void setCenter(centre.x, centre.y, { zoom: getZoom(), duration: 350 })
  }

  // Tidy: lay the board out organically (see lib/tidy), gliding boxes to their new places.
  // One change, so one undo puts everything back.
  function tidy(): string {
    if (board.nodes.length < 2) return 'nothing to tidy yet'
    const sizes = new Map(getNodes().map((n) => [n.id, { width: n.measured?.width ?? BOX.width, height: n.measured?.height ?? BOX.height }]))
    // A Map from each box's id to where it's going, so each frame looks them up in constant time.
    const targets = new Map(tidyPositions(board, sizes).map((p) => [p.id, p]))
    const from = new Map(board.nodes.map((n) => [n.id, { x: n.x, y: n.y }]))
    const finished = moveNodes(board, [...targets.values()])
    const start = performance.now()
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450
    const ease = (t: number) => 1 - (1 - t) ** 3
    const step = (now: number) => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1
      setNodes((nodes) =>
        nodes.map((n) => {
          const a = from.get(n.id)
          const b = targets.get(n.id)
          if (!a || !b) return n
          return { ...n, position: { x: a.x + (b.x - a.x) * ease(t), y: a.y + (b.y - a.y) * ease(t) } }
        }),
      )
      if (t < 1) requestAnimationFrame(step)
      else commit(board, finished)
    }
    requestAnimationFrame(step)
    return 'tidied the board (undo puts it back)'
  }
  // Shows a node: selects it and pans the board to it.
  function show(id: string, on: Board = board) {
    const node = findNode(on, id)
    if (!node) return
    setNodes((nodes) => nodes.map((n) => ({ ...n, selected: n.id === id })))
    const centre = centreOfBox(node)
    void setCenter(centre.x, centre.y, { zoom: 1, duration: 400 })
  }

  // A note from the vending machine lands next to what you have selected, or in the middle of the view.
  function noteSpot(): { x: number; y: number } {
    const current = latest.current
    const selected = getNodes().filter((n) => n.selected)
    const anchor = selected.length === 1 ? findNode(current, selected[0].id) : undefined
    return anchor ? spotNear(current, { x: anchor.x + placeFor(phone).note.x, y: anchor.y + placeFor(phone).note.y }) : centreOf(current)
  }

  // For the machine's flying note: where it will land, on screen, at the board's zoom. If that
  // spot is out of view, the board glides there first (then it's asked again).
  function noteLanding(): { at: { x: number; y: number }; left: number; top: number; zoom: number; inView: boolean } {
    const at = noteSpot()
    const view = viewRect()
    const inView = !view || (at.x >= view.x && at.y >= view.y && at.x + BOX.width <= view.x + view.width && at.y + BOX.height <= view.y + view.height)
    if (!inView) reveal(at)
    const { x: left, y: top } = flowToScreenPosition(at)
    return { at, left, top, zoom: getZoom(), inView }
  }

  return { viewRect, spotNear, centreOf, reveal, show, noteSpot, noteLanding, tidy }
}
