import type { Board } from './board'
import { applyChange, type BoardChange } from './changes'

// Undo and redo keep whole-board snapshots in memory for this session.
// Boards are small (15 nodes), so snapshots are cheap and can't get out of step.

export const UNDO_LIMIT = 100

export type UndoState = { past: Board[]; future: Board[] }

export const emptyUndo = (): UndoState => ({ past: [], future: [] })

export function pushChange(state: UndoState, previous: Board): UndoState {
  return { past: [...state.past, previous].slice(-UNDO_LIMIT), future: [] }
}

export function undo(state: UndoState, current: Board): { state: UndoState; board: Board } | null {
  const board = state.past.at(-1)
  if (!board) return null
  return { board, state: { past: state.past.slice(0, -1), future: [current, ...state.future] } }
}

export function redo(state: UndoState, current: Board): { state: UndoState; board: Board } | null {
  const [board, ...future] = state.future
  if (!board) return null
  return { board, state: { past: [...state.past, current].slice(-UNDO_LIMIT), future } }
}

// Someone else changed the board. Their change goes into every snapshot too, so undo and redo
// only ever take back your own changes, never theirs.
export function absorb(state: UndoState, change: BoardChange): UndoState {
  return { past: state.past.map((b) => applyChange(b, change)), future: state.future.map((b) => applyChange(b, change)) }
}
