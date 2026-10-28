import { createContext, useContext } from 'react'

// Lets nodes deep inside React Flow ask the workspace to edit or delete them.
export type BoardActions = {
  editingId: string | null
  startEdit: (id: string) => void
  commitEdit: (id: string, text: string) => void
  cancelEdit: () => void
  deleteNode: (id: string) => void
}

export const BoardActionsContext = createContext<BoardActions | null>(null)

export function useBoardActions(): BoardActions {
  const actions = useContext(BoardActionsContext)
  if (!actions) throw new Error('useBoardActions must be used inside BoardActionsContext')
  return actions
}
