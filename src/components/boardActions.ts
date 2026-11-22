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
  // Down-vote anything, or take it back (the down-vote button). Takes away your favourite on it.
  downvote: (id: string) => void
  // Whether other people are on this board: then each box shows how many favourited and
  // down-voted it. On a board only you have, just your own heart or down-vote shows.
  shared: boolean
  deleteNode: (id: string) => void
  // Delete several things at once (and remove selected links), as one change.
  deleteMany: (ids: string[], links: [string, string][]) => void
  // For the keyboard: undo and redo, a new idea in the middle of the view, a short message by
  // the board's title, and the shortcuts cheat sheet.
  undo: () => void
  redo: () => void
  addIdea: () => void
  // Fit the whole board on screen (z f), and put a copied box's text back as a new idea (p),
  // next to the selected box or in the middle of the view.
  fit: () => void
  paste: (text: string, nearId?: string) => void
  say: (message: string) => void
  showKeys: () => void
  // On a shared board, the name of someone on it ("you" for you); otherwise undefined.
  whoIs: (accountId?: string) => string | undefined
  // Linking by tapping (the link button on a phone): the box waiting for its other end, starting
  // that wait, linking it to the next box tapped, and giving up (a tap on the empty board).
  linkingFrom: string | null
  startLink: (id: string) => void
  linkTo: (id: string) => void
  cancelLink: () => void
}

export const BoardActionsContext = createContext<BoardActions | null>(null)

export function useBoardActions(): BoardActions {
  const actions = useContext(BoardActionsContext)
  if (!actions) throw new Error('useBoardActions must be used inside BoardActionsContext')
  return actions
}
