import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
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
import { deleteUserNode, removeLink } from '../lib/boardOps'
import { toFlowEdges, toFlowNodes, withPositions, type IdeaFlowNode } from '../lib/flow'
import { useBoardActions } from './boardActions'
import { CentreEdge } from './CentreEdge'
import { IdeaNode } from './IdeaNode'

const nodeTypes = { idea: IdeaNode }
const edgeTypes = { centre: CentreEdge }

type Props = {
  board: Board
  onChange: (board: Board) => void
  onAddAt: (position: { x: number; y: number }) => void
  onAddButton: () => void
  onLink: (a: string, b: string) => void
}

export function BoardCanvas({ board, onChange, onAddAt, onAddButton, onLink }: Props) {
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow<IdeaFlowNode>()
  const { editingId, startEdit } = useBoardActions()

  // React Flow owns positions and selection while you interact; the board is the saved truth.
  const [nodes, setNodes] = useState<IdeaFlowNode[]>(() => toFlowNodes(board))
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(board))

  // When the board changes (add, edit, delete, terminal), rebuild nodes but keep what's selected.
  // Done during render rather than in an effect, as React recommends for derived state.
  const [syncedBoard, setSyncedBoard] = useState(board)
  if (board !== syncedBoard) {
    setSyncedBoard(board)
    setNodes((current) => {
      const selected = new Set(current.filter((n) => n.selected).map((n) => n.id))
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

  // Keyboard: Enter edits the selected idea; Delete/Backspace removes selected ideas and links.
  function handleKeyDown(event: KeyboardEvent) {
    if (editingId || (event.target as Element).closest('input, textarea')) return
    const selected = getNodes().filter((n) => n.selected && n.data.kind === 'user')
    if (event.key === 'Enter' && selected.length === 1) {
      event.preventDefault()
      startEdit(selected[0].id)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      // Apply every removal to one board, so deleting several things at once saves them all.
      let next = board
      for (const e of getEdges().filter((e) => e.selected)) {
        const r = removeLink(next, e.source, e.target)
        if (r.ok) next = r.board
      }
      for (const n of selected) {
        const r = deleteUserNode(next, n.id)
        if (r.ok) next = r.board
      }
      if (next !== board) onChange(next)
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
      connectionRadius={40}
      onNodeDragStop={handleDragStop}
      onNodeDoubleClick={(_e, node) => node.data.kind === 'user' && startEdit(node.id)}
      onDoubleClick={handleDoubleClick}
      onPaneClick={finishEditing}
      onNodeClick={(_e, node) => node.id !== editingId && finishEditing()}
      onKeyDown={handleKeyDown}
      zoomOnDoubleClick={false}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.4, maxZoom: 1.2 }}
      minZoom={0.3}
      maxZoom={2}
      // We handle deleting ourselves, so sparks and nudges can't be removed.
      deleteKeyCode={null}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2f3a" />
      <Controls showInteractive={false} />
      <Panel position="top-left">
        <button type="button" className="board__add" onClick={onAddButton}>
          + idea
        </button>
        <span className="board__hint">
          double-click the board to add · double-click an idea to edit · drag from a dot to link
        </span>
      </Panel>
    </ReactFlow>
  )
}
