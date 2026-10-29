import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { BOARD_CAPACITY, type Board } from '../lib/board'
import { addLink, addLinkedIdea, addNudge, addUserNode, deleteUserNode, editUserNode, findNode, swapSpark } from '../lib/boardOps'
import { runCommand, type CommandResult } from '../lib/commands'
import { complete } from '../lib/complete'
import { NUDGE_CHOICES, pickNudge, type NudgeChoice } from '../lib/nudges/pickNudge'
import { freeSpotNear } from '../lib/placement'
import { swapFor, type Spark } from '../lib/sparks/deal'
import { loadSeen, rememberSeen } from '../lib/sparks/seen'
import type { BoardSummary } from '../lib/storage'
import { emptyUndo, pushChange, redo, undo, type UndoState } from '../lib/undo'
import { BoardActionsContext, type BoardActions } from './boardActions'
import { BoardCanvas } from './BoardCanvas'
import { Terminal, type TerminalHandle } from './Terminal'

type Props = {
  board: Board
  boards: BoardSummary[]
  onChange: (board: Board) => void
  onNewBoard: () => void
  onOpenBoard: (id: string) => void
}

// Text a brand-new idea starts with, selected so typing replaces it.
const NEW_IDEA = 'new idea'

const isTyping = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea')

// The board plus the terminal. Both edit the same board through the same operations.
export function Workspace({ board, boards, onChange, onNewBoard, onOpenBoard }: Props) {
  const { screenToFlowPosition, getNodes } = useReactFlow()
  const boardRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<TerminalHandle>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [history, setHistory] = useState<UndoState>(emptyUndo)
  // Nudges arrive asynchronously, so they must be added to the latest board, not the one at click time.
  const latest = useRef(board)
  useEffect(() => {
    latest.current = board
  })

  // Notices (like "the board is full") fade after a few seconds.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  // Every change goes through here so it can be undone. `previous` is passed explicitly
  // so two changes in a row (save an edit, then add a linked idea) undo one at a time.
  function commit(previous: Board, next: Board) {
    setHistory((h) => pushChange(h, previous))
    onChange(next)
  }

  function stepBack(): string {
    const result = undo(history, board)
    if (!result) return 'nothing to undo'
    setHistory(result.state)
    setEditingId(null)
    onChange(result.board)
    return 'undone'
  }

  function stepForward(): string {
    const result = redo(history, board)
    if (!result) return 'nothing to redo'
    setHistory(result.state)
    setEditingId(null)
    onChange(result.board)
    return 'redone'
  }

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Inside a text box the browser's own undo wins.
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

  // The nearest free spot to the middle of the visible board.
  function visibleCentre() {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return freeSpotNear(board, { x: 0, y: 0 })
    return freeSpotNear(board, screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }))
  }

  function addAndEdit(at: { x: number; y: number }) {
    const result = addUserNode(board, NEW_IDEA, at)
    if (!result.ok) {
      setNotice(result.error)
      return
    }
    commit(board, result.board)
    setEditingId(result.node?.id ?? null)
  }

  // Tab: add a new idea linked to `fromId`, just below it, and start typing in it.
  function branchFrom(from: Board, fromId: string) {
    const parent = findNode(from, fromId)
    if (!parent) return
    const at = freeSpotNear(from, { x: parent.x + 115, y: parent.y + 190 })
    const result = addLinkedIdea(from, fromId, NEW_IDEA, at)
    if (!result.ok) {
      setNotice(result.error)
      return
    }
    commit(from, result.board)
    setEditingId(result.node?.id ?? null)
  }

  // N key, the device button, or `nudge <id>` in the terminal. Returns what happened, for the terminal.
  async function requestNudge(targetId: string, type?: NudgeChoice): Promise<{ text: string; error?: boolean }> {
    const nudge = await pickNudge(latest.current, targetId, { type })
    const current = latest.current
    const target = findNode(current, targetId)
    if (!target) return { text: `No node called ${targetId}`, error: true }
    if (!nudge) {
      const message = `${targetId} is a nudge already. Nudge the idea or disk it's about instead.`
      setNotice(message)
      return { text: message, error: true }
    }
    const at = freeSpotNear(current, { x: target.x + 380, y: target.y + 45 })
    const result = addNudge(current, targetId, nudge, at)
    if (!result.ok) {
      setNotice(result.error)
      return { text: result.error, error: true }
    }
    commit(current, result.board)
    return { text: `${result.node?.id} (${nudge.type}): ${nudge.text}` }
  }

  function nudgeSelected() {
    const selected = getNodes().filter((n) => n.selected)
    if (selected.length !== 1) {
      setNotice('Select one idea first, then press N (or this button) for a nudge.')
      return
    }
    void requestNudge(selected[0].id)
  }

  // Swap a spark for a new one from a category the other sparks don't use. Uses one of the board's 3 swaps.
  function swap(id: string): { text: string; error?: boolean } {
    const node = findNode(board, id)
    if (!node || node.kind !== 'spark' || !node.category) return { text: `${id} isn't a disk: only disks can be swapped`, error: true }
    const others: Spark[] = board.nodes
      .filter((n) => n.kind === 'spark' && n.id !== id && n.category)
      .map((n) => ({ text: n.text, category: n.category! }))
    const next = swapFor({ text: node.text, category: node.category }, others, { seen: loadSeen() })
    const result = swapSpark(board, id, next)
    if (!result.ok) {
      setNotice(result.error)
      return { text: result.error, error: true }
    }
    rememberSeen([next.text])
    commit(board, result.board)
    return { text: `swapped ${id}: ${next.text} (${result.board.swapsLeft} swaps left)` }
  }

  function saveEdit(id: string, text: string): Board {
    const node = findNode(board, id)
    if (node?.text === text.trim()) return board
    const result = editUserNode(board, id, text)
    if (!result.ok) return board
    // Typing into a brand-new idea counts as part of adding it, so one undo removes both.
    if (node?.text === NEW_IDEA) onChange(result.board)
    else commit(board, result.board)
    return result.board
  }

  const actions: BoardActions = {
    editingId,
    startEdit: setEditingId,
    cancelEdit: () => {
      // Escape on a brand-new idea means "never mind", so take it back off the board.
      const node = editingId ? findNode(board, editingId) : undefined
      setEditingId(null)
      if (node?.text === NEW_IDEA) stepBack()
    },
    commitEdit: (id, text) => {
      setEditingId(null)
      // Empty or unchanged text keeps the idea as it was.
      saveEdit(id, text)
    },
    commitAndBranch: (id, text) => branchFrom(saveEdit(id, text), id),
    branch: (id) => branchFrom(board, id),
    nudge: (id) => void requestNudge(id),
    swap: (id) => void swap(id),
    swapsLeft: board.swapsLeft,
    deleteNode: (id) => {
      const result = deleteUserNode(board, id)
      if (result.ok) commit(board, result.board)
    },
  }

  function handleCommand(input: string): CommandResult {
    const word = input.trim().toLowerCase()
    if (word === 'undo') return { output: [stepBack()] }
    if (word === 'redo') return { output: [stepForward()] }
    if (word === 'new') {
      onNewBoard()
      return { output: ['opening a new board…'] }
    }
    if (word === 'boards') {
      return { output: boards.map((b, i) => `  ${String(i + 1).padStart(2)}  ${b.name}${b.id === board.id ? '  ← open' : ''}`).concat('open one with: open <number>') }
    }
    if (word.startsWith('open')) {
      const n = Number(word.split(/\s+/)[1])
      const target = boards[n - 1]
      if (!target) return { output: ['usage: open <number> (see: boards)'], error: true }
      onOpenBoard(target.id)
      return { output: [`opening ${target.name}…`] }
    }
    if (word.startsWith('swap')) {
      const [, id, extra] = word.split(/\s+/)
      if (!id || extra) return { output: ['usage: swap <id>'], error: true }
      const r = swap(id)
      return { output: [r.text], error: r.error }
    }
    if (word.startsWith('nudge')) {
      const [, id, type, extra] = word.split(/\s+/)
      if (!id || extra) return { output: ['usage: nudge <id> [type]'], error: true }
      if (!findNode(board, id)) return { output: [`No node called ${id}`], error: true }
      if (type && !NUDGE_CHOICES.includes(type as NudgeChoice))
        return { output: [`unknown nudge type "${type}". try: ${NUDGE_CHOICES.join(' ')}`], error: true }
      void requestNudge(id, type as NudgeChoice | undefined).then((r) => terminalRef.current?.print([r.text], r.error))
      return { output: [`nudging ${id}…`] }
    }
    const result = runCommand(board, input, { addAt: visibleCentre() })
    if (result.board) commit(board, result.board)
    return result
  }

  const used = Math.min(board.nodes.length, BOARD_CAPACITY)

  return (
    <BoardActionsContext.Provider value={actions}>
      <div className="workspace">
        <nav className="device__rail" aria-label="Device buttons">
          <button type="button" className="device__button" aria-label="Add an idea" title="Add an idea" onClick={() => addAndEdit(visibleCentre())}>
            +
          </button>
          <button type="button" className="device__button" aria-label="Nudge the selected idea" title="Nudge the selected idea (N)" onClick={nudgeSelected}>
            N
          </button>
          <button type="button" className="device__button" aria-label="Open the terminal" title="Terminal (Ctrl+`)" onClick={() => terminalRef.current?.focus()}>
            &gt;_
          </button>
          <button type="button" className="device__button" aria-label="Show help" title="Help" onClick={() => terminalRef.current?.run('help')}>
            ?
          </button>
        </nav>

        <div className="device__screen">
          <header className="screen__bar">
            <span className="screen__title">board</span>
            <label className="screen__switch">
              <span className="visually-hidden">Open a board</span>
              <select value={board.id} onChange={(e) => onOpenBoard(e.target.value)}>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="screen__new" onClick={onNewBoard}>
              + new board
            </button>
            <span className="screen__swaps" title="Swap a disk: select it and press S">
              swaps left: {board.swapsLeft}
            </span>
            {notice && (
              <span className="screen__notice" role="status">
                {notice}
              </span>
            )}
          </header>
          <div className="workspace__board" ref={boardRef}>
            <BoardCanvas
              board={board}
              onChange={(next) => commit(board, next)}
              onAddAt={addAndEdit}
              onLink={(a, b) => {
                const result = addLink(board, a, b)
                if (result.ok) commit(board, result.board)
              }}
            />
          </div>
          <Terminal ref={terminalRef} onRun={handleCommand} onComplete={(input) => complete(input, board, boards.length)} />
        </div>

        {/* How full the board is. A full board is the cue to stop exploring. */}
        <div
          className={`device__gauge${used >= BOARD_CAPACITY * 0.9 ? ' device__gauge--nearly-full' : ''}`}
          role="meter"
          aria-label="Board space used"
          aria-valuemin={0}
          aria-valuemax={BOARD_CAPACITY}
          aria-valuenow={used}
          title={`${used} of ${BOARD_CAPACITY} spaces used`}
        >
          <div className="device__gauge-fill" style={{ height: `${(used / BOARD_CAPACITY) * 100}%` }} />
        </div>
      </div>
    </BoardActionsContext.Provider>
  )
}
