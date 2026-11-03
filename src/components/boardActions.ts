import { createContext, useContext } from 'react'

// Lets nodes deep inside React Flow ask the workspace to edit or delete them.
export type BoardActions = {
  editingId: string | null
  startEdit: (id: string) => void
  commitEdit: (id: string, text: string) => void
  // Save the edit, then add a new idea linked to this one (Tab while typing).
  commitAndBranch: (id: string, text: string) => void
  // Add a new idea linked to this one (Tab on a selected node).
  branch: (id: string) => void
  cancelEdit: () => void
  // Ask for a nudge on this idea (N key).
  nudge: (id: string) => void
  // Favourite or unfavourite anything (F key or the heart button).
  favourite: (id: string) => void
  // Mark the idea you're going with.
  pick: (id: string) => void
  deleteNode: (id: string) => void
  // Delete several things at once (and remove selected links), as one change.
  deleteMany: (ids: string[], links: [string, string][]) => void
  // For the keyboard: undo and redo, a new idea in the middle of the view, a short message by
  // the board's title, and the shortcuts cheat sheet.
  undo: () => void
  redo: () => void
  addIdea: () => void
  say: (message: string) => void
  showKeys: () => void
}

export const BoardActionsContext = createContext<BoardActions | null>(null)

export function useBoardActions(): BoardActions {
  const actions = useContext(BoardActionsContext)
  if (!actions) throw new Error('useBoardActions must be used inside BoardActionsContext')
  return actions
}
