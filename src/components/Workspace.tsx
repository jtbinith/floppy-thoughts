import { useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Board } from '../lib/board'
import { addLink, addUserNode, deleteUserNode, editUserNode, findNode } from '../lib/boardOps'
import { runCommand } from '../lib/commands'
import { BoardActionsContext, type BoardActions } from './boardActions'
import { BoardCanvas } from './BoardCanvas'
import { Terminal } from './Terminal'

type Props = {
  board: Board
  onChange: (board: Board) => void
}

// The board plus the terminal. Both edit the same board through the same operations.
export function Workspace({ board, onChange }: Props) {
  const { screenToFlowPosition } = useReactFlow()
  const boardRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Middle of the visible board, nudged a little so repeated adds don't stack exactly.
  function visibleCentre() {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const jitter = () => (Math.random() - 0.5) * 80
    return screenToFlowPosition({ x: rect.left + rect.width / 2 + jitter(), y: rect.top + rect.height / 2 + jitter() })
  }

  function addAndEdit(at: { x: number; y: number }) {
    const result = addUserNode(board, 'new idea', at)
    if (!result.ok) return
    onChange(result.board)
    setEditingId(result.node?.id ?? null)
  }

  const actions: BoardActions = {
    editingId,
    startEdit: setEditingId,
    cancelEdit: () => setEditingId(null),
    commitEdit: (id, text) => {
      setEditingId(null)
      // Empty or unchanged text keeps the idea as it was.
      if (findNode(board, id)?.text === text.trim()) return
      const result = editUserNode(board, id, text)
      if (result.ok) onChange(result.board)
    },
    deleteNode: (id) => {
      const result = deleteUserNode(board, id)
      if (result.ok) onChange(result.board)
    },
  }

  function handleCommand(input: string) {
    const result = runCommand(board, input, { addAt: visibleCentre() })
    if (result.board) onChange(result.board)
    return result
  }

  return (
    <BoardActionsContext.Provider value={actions}>
      <div className="workspace">
        <div className="workspace__board" ref={boardRef}>
          <BoardCanvas
            board={board}
            onChange={onChange}
            onAddAt={addAndEdit}
            onAddButton={() => addAndEdit(visibleCentre())}
            onLink={(a, b) => {
              const result = addLink(board, a, b)
              if (result.ok) onChange(result.board)
            }}
          />
        </div>
        <Terminal onRun={handleCommand} />
      </div>
    </BoardActionsContext.Provider>
  )
}
