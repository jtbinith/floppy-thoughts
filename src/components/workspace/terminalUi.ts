import { numberOf, type Board } from '../../lib/board'
import { findNode } from '../../lib/boardOps'
import type { BoardUi } from '../../lib/commands'
import type { NudgeChoice } from '../../lib/nudges/pickNudge'
import { VEND_ROWS, rowEmpty, type VendRow } from '../../lib/sparks/vend'
import type { BoardSummary } from '../../lib/storage'
import type { MachineControl } from '../machine/HomeMachine'
import type { PanelTab } from '../SidePanel'

type Result = { text: string; error?: boolean }

// What the board on screen does for terminal commands that need more than the board itself:
// undo, tidy, fit, the boards list, deleting (which may ask first), the summary, and the
// vending machine in the drawer (/vend runs it, then /swap, /stick and /back).
export function terminalUi(deps: {
  board: Board
  boards: BoardSummary[]
  stepBack: () => string
  stepForward: () => string
  tidy: () => string
  fit: () => void
  openPanel: (tab: PanelTab) => void
  onNewBoard: () => void
  onOpenBoard: (id: string) => void
  // Deleting may stop to ask whether to keep a chain connected (then it returns false).
  requestDelete: (ids: string[]) => boolean
  showSummary: () => void
  makeFavouritesBoard: () => string
  // The machine in the drawer, once it's loaded.
  machine: () => MachineControl | null
  requestNudge: (id: string, type?: NudgeChoice) => Promise<Result>
  print: (lines: string[], error?: boolean) => void
}): BoardUi {
  const { board, boards, machine } = deps

  // `/vend` opens the drawer and runs the machine there, so you see the capsule and the shrimp
  // crack open. The machine may still be loading, so it tries for a moment.
  function vendFromTerminal(row: VendRow): Result {
    if (rowEmpty(row, new Set(board.nodes.map((n) => n.text)))) return { text: `the ${row} row is empty: every one of those notes is on this board`, error: true }
    deps.openPanel('machine')
    let tries = 0
    const run = () => {
      const m = machine()
      if (m) m.vend(row === 'surprise' ? undefined : row)
      else if (tries++ < 60) setTimeout(run, 50)
    }
    run()
    return { text: 'a shrimp is on its way… then /stick, /swap or /back' }
  }

  return {
    undo: deps.stepBack,
    redo: deps.stepForward,
    tidy: deps.tidy,
    fit: () => {
      deps.fit()
      return board.nodes.length ? 'fitted the board to the screen' : 'the board is empty'
    },
    showCommands: () => deps.openPanel('commands'),
    newBoard: deps.onNewBoard,
    boards: () => boards.map((b) => ({ name: b.id === board.id ? board.name : b.name, open: b.id === board.id })),
    openBoard: (n) => {
      const target = boards[n - 1]
      if (!target) return null
      deps.onOpenBoard(target.id)
      return target.name
    },
    remove: (id) => {
      const text = findNode(board, id)?.text
      return deps.requestDelete([id]) ? `deleted ${numberOf(board, id)}: ${text}` : `${numberOf(board, id)} is in the middle of a chain: answer on the board`
    },
    showSummary: () => {
      deps.showSummary()
      return true
    },
    favouritesBoard: deps.makeFavouritesBoard,
    vend: (row) => {
      if (row && !VEND_ROWS.includes(row as VendRow)) return { text: `there's no ${row} row. rows: ${VEND_ROWS.join(' ')}`, error: true }
      return vendFromTerminal((row as VendRow | undefined) ?? 'surprise')
    },
    note: (action) => {
      const text = machine()?.note(action)
      if (!text) return { text: 'no note is out of the machine. try /vend', error: true }
      return { text: { swap: `swapped ${text}…`, stick: `stuck on the board: ${text}`, back: `put back: ${text}` }[action] }
    },
    nudge: (id, type) => void deps.requestNudge(id, type as NudgeChoice | undefined).then((r) => deps.print([r.text], r.error)),
  }
}
