import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ConnectionMode,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Board, BoardNode } from '../lib/board'
import { FIT_VIEW, toFlowEdges, toFlowNodes, withPositions, type IdeaFlowNode } from '../lib/flow'
import { nearestInDirection, nearestTo, type Direction } from '../lib/nav'
import { BOX } from '../lib/placement'
import { numberOf } from '../lib/board'
import { useBoardActions } from './boardActions'
import { CentreEdge } from './CentreEdge'
import { IdeaNode } from './IdeaNode'
import { LinkPreview } from './LinkPreview'

const nodeTypes = { idea: IdeaNode }
const edgeTypes = { centre: CentreEdge }

type Props = {
  board: Board
  onChange: (board: Board) => void
  onAddAt: (position: { x: number; y: number }) => void
  // Lay the board out tidily (the button under the zoom controls).
  onTidy: () => void
  onLink: (a: string, b: string) => void
}

export function BoardCanvas({ board, onChange, onAddAt, onTidy, onLink }: Props) {
  const { screenToFlowPosition, getNodes, getEdges, setCenter, getZoom } = useReactFlow<IdeaFlowNode>()
  const { editingId, startEdit, branch, nudge, favourite, deleteMany, undo, redo, addIdea, say, showKeys, fit, paste } = useBoardActions()
  // y y copies a box's text here; p puts it back as a new idea (like vim's yank and put).
  const yanked = useRef<string | null>(null)

  // React Flow owns positions and selection while you interact; the board is the saved truth.
  const [nodes, setNodes] = useState<IdeaFlowNode[]>(() => toFlowNodes(board))
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(board))

  // When the board changes (add, edit, delete, terminal), rebuild nodes but keep what's selected.
  // If one new thing appeared (a typed idea, a note, the theme), select just that, so Tab, N and F
  // work on it straight away. A new nudge leaves its idea selected, so N again gives another.
  // Done during render rather than in an effect, as React recommends for derived state.
  const [syncedBoard, setSyncedBoard] = useState(board)
  if (board !== syncedBoard) {
    const before = new Set(syncedBoard.nodes.map((n) => n.id))
    const added = board.nodes.filter((n) => !before.has(n.id))
    const fresh = added.length === 1 && added[0].kind !== 'nudge' ? added[0].id : null
    setSyncedBoard(board)
    setNodes((current) => {
      const selected = fresh ? new Set([fresh]) : new Set(current.filter((n) => n.selected).map((n) => n.id))
      return toFlowNodes(board).map((n) => ({ ...n, selected: selected.has(n.id) }))
    })
    setEdges((current) => {
      const selected = new Set(current.filter((e) => e.selected).map((e) => e.id))
      return toFlowEdges(board).map((e) => ({ ...e, selected: selected.has(e.id) }))
    })
  }

  function handleNodesChange(changes: NodeChange<IdeaFlowNode>[]) {
    setNodes((current) => applyNodeChanges(changes, current))
  }

  // Edges only change selection locally; adding and removing goes through the board.
  function handleEdgesChange(changes: EdgeChange[]) {
    setEdges((current) => applyEdgeChanges(changes.filter((c) => c.type === 'select'), current))
  }

  function handleConnect({ source, target }: Connection) {
    if (source && target) onLink(source, target)
  }

  // React Flow only links when you drop onto a dot. Dropping anywhere on a node is easier,
  // especially on touch screens, so handle that case too.
  function handleConnectEnd(event: globalThis.MouseEvent | TouchEvent, state: FinalConnectionState) {
    if (state.isValid || !state.fromNode) return
    const point = 'changedTouches' in event ? event.changedTouches[0] : event
    const target = document.elementFromPoint(point.clientX, point.clientY)?.closest('.react-flow__node')
    const targetId = target?.getAttribute('data-id')
    if (targetId && targetId !== state.fromNode.id) onLink(state.fromNode.id, targetId)
  }

  // React Flow passes the dragged nodes with their final positions.
  function handleDragStop(_event: unknown, _node: IdeaFlowNode, dragged: IdeaFlowNode[]) {
    onChange(withPositions(board, dragged))
  }

  // Double-click empty board space to add an idea there.
  function handleDoubleClick(event: MouseEvent) {
    // Nodes sit inside the pane element too, so rule out nodes and the toolbar explicitly.
    const target = event.target as Element
    if (!target.closest('.react-flow__pane') || target.closest('.react-flow__node, .react-flow__panel')) return
    onAddAt(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  // React Flow swallows mousedown on the board, so clicking away wouldn't normally end an edit.
  // Blurring the editor saves it (see IdeaNode).
  function finishEditing() {
    if (editingId && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  // --- The keyboard, vim-style (see KeysSheet for the list). Works while the board has focus. ---
  // A key waiting for its pair (g g, z z), and the box a link starts from (c … c).
  const pending = useRef<{ key: string; at: number } | null>(null)
  const linkFrom = useRef<string | null>(null)
  const MOVE_STEP = 24
  const rootRef = useRef<HTMLDivElement>(null)

  // If the focused box goes (deleted, or a new idea you cancelled), keep the focus on the board,
  // so the next key still works.
  // And if nothing has focus at all (the box you were on just went), the board still takes the
  // key, as long as no dialog is open.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.target === document.body && rootRef.current && !document.querySelector('[role="dialog"]')) handleKey(e, rootRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // (React Flow takes the box out a frame or two later, so check after that.)
  useEffect(() => {
    if (editingId) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const active = document.activeElement
        if (active && active !== document.body && active.isConnected) return
        const selected = rootRef.current?.querySelector<HTMLElement>('.react-flow__node.selected')
        ;(selected ?? rootRef.current)?.focus({ preventScroll: true })
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [board, editingId])

  const boxes = () =>
    getNodes().map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.measured?.width ?? BOX.width, height: n.measured?.height ?? BOX.height }))

  // Select one box, focus it, and glide the board if it's out of view.
  function selectOnly(id: string, root: HTMLElement) {
    setNodes((current) => current.map((n) => ({ ...n, selected: n.id === id })))
    setEdges((current) => current.map((e) => ({ ...e, selected: false })))
    requestAnimationFrame(() => {
      const el = root.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
      el?.focus({ preventScroll: true })
      const area = root.getBoundingClientRect()
      const r = el?.getBoundingClientRect()
      const margin = 30
      if (r && (r.left < area.left + margin || r.right > area.right - margin || r.top < area.top + margin || r.bottom > area.bottom - margin)) centreOn(id)
    })
  }

  function centreOn(id: string) {
    const b = boxes().find((x) => x.id === id)
    if (b) void setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: getZoom(), duration: 250 })
  }

  function go(direction: Direction, root: HTMLElement) {
    const all = boxes()
    if (!all.length) return
    const current = getNodes().filter((n) => n.selected)
    if (current.length !== 1) {
      // Nothing (or several) selected: start from the box nearest the middle of the view.
      const area = root.getBoundingClientRect()
      const middle = screenToFlowPosition({ x: area.left + area.width / 2, y: area.top + area.height / 2 })
      const start = nearestTo(all, middle)
      if (start) selectOnly(start, root)
      return
    }
    const next = nearestInDirection(all, current[0].id, direction)
    if (next) selectOnly(next, root)
  }

  // Shift + h j k l: move what's selected a little, saved as one change.
  function shift(direction: Direction) {
    const moving = getNodes().filter((n) => n.selected)
    if (!moving.length) return
    const d = { left: [-MOVE_STEP, 0], right: [MOVE_STEP, 0], up: [0, -MOVE_STEP], down: [0, MOVE_STEP] }[direction]
    onChange(withPositions(board, moving.map((n) => ({ ...n, position: { x: n.position.x + d[0], y: n.position.y + d[1] } }))))
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement> | globalThis.KeyboardEvent, root: HTMLElement) {
    if (editingId || (event.target as Element).closest('input, textarea')) return
    const allSelected = getNodes().filter((n) => n.selected)
    const one = allSelected.length === 1 ? allSelected[0] : null
    // What you wrote yourself can be edited: your ideas and your themes.
    const editable = (n: IdeaFlowNode) => n.data.kind === 'user' || n.data.category === 'theme'
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey
    const key = event.key
    const handled = () => {
      event.preventDefault()
      event.stopPropagation()
    }
    // A pair like g g or z z: the second press within a moment.
    const pair = (k: string) => {
      const now = Date.now()
      const isPair = pending.current?.key === k && now - pending.current.at < 700
      pending.current = isPair ? null : { key: k, at: now }
      return isPair
    }
    const directions: Record<string, Direction> = { h: 'left', ArrowLeft: 'left', j: 'down', ArrowDown: 'down', k: 'up', ArrowUp: 'up', l: 'right', ArrowRight: 'right' }
    const direction = directions[key] ?? directions[key.toLowerCase()]

    if (direction && !event.ctrlKey && !event.metaKey && !event.altKey) {
      handled()
      if (event.shiftKey) shift(direction)
      else go(direction, root)
    } else if (key === 'r' && event.ctrlKey) {
      handled()
      redo()
    } else if (!plain) {
      return
    } else if (key === 'c' || (key === 'Enter' && linkFrom.current)) {
      handled()
      if (!one) return say('select one box to link from')
      if (!linkFrom.current) {
        linkFrom.current = one.id
        say(`linking from ${one.data.number}: move to another box and press c (Esc to stop)`)
      } else if (linkFrom.current === one.id) {
        say('move to another box first, then press c')
      } else {
        onLink(linkFrom.current, one.id)
        say(`linked ${numberOf(board, linkFrom.current)} to ${one.data.number}`)
        linkFrom.current = null
      }
    } else if (key === 'Escape') {
      handled()
      if (linkFrom.current) {
        linkFrom.current = null
        say('stopped linking')
      } else {
        setNodes((current) => current.map((n) => ({ ...n, selected: false })))
        setEdges((current) => current.map((e) => ({ ...e, selected: false })))
      }
    } else if (key === 'i' || key === 'Enter') {
      if (!one) return
      handled()
      if (editable(one)) startEdit(one.id)
      else say('only your own ideas and themes can be edited')
    } else if ((key === 'o' || (key === 'Tab' && !event.shiftKey)) && one) {
      // Any box, including notes, can grow a linked idea.
      handled()
      branch(one.id)
    } else if (key === 'a') {
      handled()
      addIdea()
    } else if (key === 'f' && pending.current?.key === 'z' && Date.now() - pending.current.at < 700) {
      // z f: fit the board on screen (z is vim's key for the view).
      handled()
      pending.current = null
      fit()
    } else if (key === 'f' && one) {
      handled()
      favourite(one.id)
    } else if (key === 'n' && one) {
      handled()
      nudge(one.id)
    } else if (key === 'u') {
      handled()
      undo()
    } else if (key === 'g') {
      handled()
      if (pair('g')) {
        const theme = board.nodes.find((n) => n.category === 'theme') ?? board.nodes[0]
        if (theme) selectOnly(theme.id, root)
      }
    } else if (key === 'z') {
      handled()
      if (pair('z') && one) centreOn(one.id)
    } else if (key === 'G') {
      // G: the last box, the partner of g g.
      handled()
      const last = board.nodes.reduce<BoardNode | undefined>((a, n) => (!a || n.number > a.number ? n : a), undefined)
      if (last) selectOnly(last.id, root)
    } else if (key === '=') {
      // =: tidy (in vim, = lays things out neatly).
      handled()
      onTidy()
    } else if (key === 'y') {
      handled()
      if (pair('y') && one) {
        yanked.current = one.data.text
        say(`copied ${one.data.number}: press p to paste it as a new idea`)
      }
    } else if (key === 'p') {
      handled()
      if (yanked.current) paste(yanked.current, one?.id)
      else say('nothing copied yet: y y on a box copies it')
    } else if (key === 'd' && !pair('d')) {
      handled()
    } else if (key === '?') {
      handled()
      showKeys()
    } else if (key === 'x' || key === 'd' || key === 'Delete' || key === 'Backspace') {
      // x, d d, Delete or Backspace (d d reaches here on its second press).
      // Everything selected goes as one change (asking first if it would break a chain).
      const links = getEdges()
        .filter((e) => e.selected)
        .map((e): [string, string] => [e.source, e.target])
      if (allSelected.length || links.length) {
        handled()
        deleteMany(allSelected.map((n) => n.id), links)
      }
    }
  }

  return (
    <ReactFlow
      ref={rootRef}
      tabIndex={-1}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      onConnectEnd={handleConnectEnd}
      // Any handle can start or end a link; links are undirected.
      connectionMode={ConnectionMode.Loose}
      connectionLineComponent={LinkPreview}
      connectionRadius={40}
      onNodeDragStop={handleDragStop}
      onNodeDoubleClick={(_e, node) => (node.data.kind === 'user' || node.data.category === 'theme') && startEdit(node.id)}
      onDoubleClick={handleDoubleClick}
      onPaneClick={finishEditing}
      onNodeClick={(_e, node) => node.id !== editingId && finishEditing()}
      // Capture, so our keys come before React Flow's own (its arrows would move boxes).
      onKeyDownCapture={(e) => handleKey(e, e.currentTarget)}
      zoomOnDoubleClick={false}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: FIT_VIEW.padding, maxZoom: FIT_VIEW.maxZoom }}
      minZoom={0.3}
      maxZoom={2}
      // We handle deleting ourselves, so one Delete removes everything selected as one undo step.
      deleteKeyCode={null}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--dots)" />
      <Controls showInteractive={false} fitViewOptions={FIT_VIEW}>
        <ControlButton onClick={onTidy} title="Tidy the board (undo puts it back)" aria-label="Tidy the board">
          <TidyIcon />
        </ControlButton>
      </Controls>
    </ReactFlow>
  )
}

// Four boxes falling into a neat arrangement.
function TidyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="6" height="4" rx="1" />
      <rect x="9" y="1" width="6" height="4" rx="1" />
      <rect x="1" y="9" width="6" height="4" rx="1" />
      <rect x="9" y="9" width="6" height="4" rx="1" />
    </svg>
  )
}
