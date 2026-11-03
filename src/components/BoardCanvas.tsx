import { useState, type KeyboardEvent, type MouseEvent } from 'react'
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
import type { Board } from '../lib/board'
import { FIT_VIEW, toFlowEdges, toFlowNodes, withPositions, type IdeaFlowNode } from '../lib/flow'
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
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow<IdeaFlowNode>()
  const { editingId, startEdit, branch, nudge, favourite, deleteMany } = useBoardActions()

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

  // Keyboard: Enter edits the selected idea; Delete/Backspace removes whatever is selected.
  function handleKeyDown(event: KeyboardEvent) {
    if (editingId || (event.target as Element).closest('input, textarea')) return
    const allSelected = getNodes().filter((n) => n.selected)
    // What you wrote yourself can be edited: your ideas and the main theme.
    const selected = allSelected.filter((n) => n.data.kind === 'user' || n.data.category === 'theme')
    const plainKey = !event.ctrlKey && !event.metaKey && !event.altKey
    if ((event.key === 'f' || event.key === 'F') && plainKey && allSelected.length === 1) {
      event.preventDefault()
      favourite(allSelected[0].id)
    } else if ((event.key === 'n' || event.key === 'N') && plainKey && allSelected.length === 1) {
      event.preventDefault()
      nudge(allSelected[0].id)
    } else if (event.key === 'Tab' && !event.shiftKey && allSelected.length === 1) {
      // Any node, including sparks, can grow a linked idea.
      event.preventDefault()
      branch(allSelected[0].id)
    } else if (event.key === 'Enter' && selected.length === 1) {
      event.preventDefault()
      startEdit(selected[0].id)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      // Everything selected goes as one change (asking first if it would break a chain).
      const links = getEdges()
        .filter((e) => e.selected)
        .map((e): [string, string] => [e.source, e.target])
      if (allSelected.length || links.length) deleteMany(allSelected.map((n) => n.id), links)
    }
  }

  return (
    <ReactFlow
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
      onKeyDown={handleKeyDown}
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
