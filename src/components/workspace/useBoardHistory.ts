import { useEffect, useRef, useState } from 'react'
import type { Board } from '../../lib/board'
import { emptyUndo, pushChange, redo, undo, type UndoState } from '../../lib/undo'
import { isTyping } from './isTyping'

// Every change to the board goes through `commit`, so it can be undone (and, later, saved or
// shared from this one place). Also undo and redo, and their keys: Ctrl/Cmd+Z undoes,
// Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Inside a text box the browser's own undo wins.
//
// `onStep` runs after an undo or redo (the workspace stops any edit then).
export function useBoardHistory(board: Board, onChange: (board: Board) => void, onStep: () => void) {
  const [history, setHistory] = useState<UndoState>(emptyUndo)
  // Nudges arrive later, so they must be added to the latest board, not the one at click time.
  const latest = useRef(board)
  useEffect(() => {
    latest.current = board
  })

  // `previous` is passed explicitly so two changes in a row (save an edit, then add a linked
  // idea) undo one at a time.
  function commit(previous: Board, next: Board) {
    setHistory((h) => pushChange(h, previous))
    // Two notes can land back to back, before React re-renders, so keep `latest` current here too.
    latest.current = next
    onChange(next)
  }

  function stepBack(): string {
    const result = undo(history, board)
    if (!result) return 'nothing to undo'
    setHistory(result.state)
    onStep()
    onChange(result.board)
    return 'undone'
  }

  function stepForward(): string {
    const result = redo(history, board)
    if (!result) return 'nothing to redo'
    setHistory(result.state)
    onStep()
    onChange(result.board)
    return 'redone'
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        stepBack()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        stepForward()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return { commit, stepBack, stepForward, latest }
}
