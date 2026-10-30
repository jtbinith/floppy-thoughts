import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { MAX_BOARD_NAME, type Board } from '../lib/board'
import { addLink, addLinkedIdea, addNote, addNudge, addUserNode, chainAround, chooseIdea, cleanText, deleteNodes, editUserNode, findNode, mainTheme, setMainTheme, swapSpark, toggleFavourite, touch } from '../lib/boardOps'
import { looksLikeCommand, runCommand, type CommandResult } from '../lib/commands'
import { favouritesBoard } from '../lib/favouritesBoard'
import { complete } from '../lib/complete'
import { NUDGE_CHOICES, pickNudge, type NudgeChoice } from '../lib/nudges/pickNudge'
import { freeSpotNear } from '../lib/placement'
import { MAX_STARTING_NOTES } from '../lib/settings'
import { swapFor, type Spark } from '../lib/sparks/deal'
import { loadSeen, rememberSeen } from '../lib/sparks/seen'
import { VEND_ROWS, vendNote, type VendRow } from '../lib/sparks/vend'
import type { BoardSummary, Favourite } from '../lib/storage'
import { emptyUndo, pushChange, redo, undo, type UndoState } from '../lib/undo'
import { BoardActionsContext, type BoardActions } from './boardActions'
import { BoardCanvas } from './BoardCanvas'
import { HeartIcon } from './HeartIcon'
import { NotePopup } from './NotePopup'
import { ChainPrompt, SummaryPopup, ThemePrompt } from './Prompts'
import { PixelShrimp } from './PixelShrimp'
import { SidePanel, type PanelTab } from './SidePanel'
import { Terminal, type TerminalHandle } from './Terminal'

type Props = {
  board: Board
  boards: BoardSummary[]
  // Favourites from every board. This board's come from `board` itself, so they're always current.
  favourites: Favourite[]
  startingNotes: number
  onStartingNotes: (n: number) => void
  onChange: (board: Board) => void
  onNewBoard: () => void
  onOpenBoard: (id: string, focusId?: string) => void
  onUnfavouriteElsewhere: (favourite: Favourite) => void
  // Save and open a board made here (a favourites board).
  onOpenNew: (board: Board) => void
  onRenameBoard: (id: string, name: string) => void
  onDeleteBoard: (id: string) => void
  // A brand-new board asks "got a theme?" first.
  askTheme: boolean
  onThemeAsked: () => void
  // Something to show as soon as the board opens, e.g. a favourite picked from another board.
  focusId?: string
}

// Whether the drawer is open, and on which tab, is remembered between visits.
const PANEL_KEY = 'hunchhack:ui:panel'
const loadPanel = (): PanelTab | null => {
  const saved = localStorage.getItem(PANEL_KEY)
  return saved === 'machine' || saved === 'favourites' || saved === 'boards' ? saved : null
}

// The board without the given links (e.g. links selected along with nodes for deleting).
function withoutLinks(board: Board, links: [string, string][]): Board {
  if (links.length === 0) return board
  const gone = (l: { from: string; to: string }) => links.some(([a, b]) => (l.from === a && l.to === b) || (l.from === b && l.to === a))
  return { ...board, links: board.links.filter((l) => !gone(l)) }
}

// Text a brand-new idea starts with, selected so typing replaces it.
const NEW_IDEA = 'new idea'

const isTyping = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea')

// The board plus the terminal. Both edit the same board through the same operations.
export function Workspace(props: Props) {
  const { board, boards, favourites, startingNotes, onStartingNotes, onChange, onNewBoard, onOpenBoard, onUnfavouriteElsewhere, focusId } = props
  const { onOpenNew, onRenameBoard, onDeleteBoard, askTheme, onThemeAsked } = props
  const { screenToFlowPosition, getNodes, setNodes, setCenter } = useReactFlow()
  const [panel, setPanelState] = useState<PanelTab | null>(loadPanel)
  const [renaming, setRenaming] = useState(false)
  // A note just out of the machine, waiting in the popup for you to stick it on or put it back.
  const [vended, setVended] = useState<Spark | null>(null)
  // Deleting from the middle of a chain asks first whether to keep it connected.
  const [pendingDelete, setPendingDelete] = useState<{
    ids: string[]
    links: [string, string][]
    chains: { id: string; around: [string, string] }[]
  } | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  // "set a theme" from the empty board opens the same question again.
  const [themeAgain, setThemeAgain] = useState(false)
  const onThemeAskedAgain = () => setThemeAgain(true)
  const closeTheme = () => {
    setThemeAgain(false)
    onThemeAsked()
  }
  const setPanel = (tab: PanelTab | null) => {
    localStorage.setItem(PANEL_KEY, tab ?? 'none')
    setPanelState(tab)
  }
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

  // Notices fade after a few seconds.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  // Every change goes through here so it can be undone. `previous` is passed explicitly
  // so two changes in a row (save an edit, then add a linked idea) undo one at a time.
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
  function centreOf(on: Board) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return freeSpotNear(on, { x: 0, y: 0 })
    return freeSpotNear(on, screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }))
  }
  const visibleCentre = () => centreOf(board)

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
      const message = `${targetId} is a nudge already. Nudge the idea or note it's about instead.`
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

  // Swap a note for another from the same row. As often as you like.
  function swap(id: string): { text: string; error?: boolean } {
    const node = findNode(board, id)
    if (!node || node.kind !== 'spark' || !node.category) return { text: `${id} isn't a note: only notes can be swapped`, error: true }
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
    return { text: `swapped ${id}: ${next.text}` }
  }

  // Shows a node: selects it and pans the board to it.
  function show(id: string, on: Board = board) {
    const node = findNode(on, id)
    if (!node) return
    setNodes((nodes) => nodes.map((n) => ({ ...n, selected: n.id === id })))
    void setCenter(node.x + 100, node.y + 40, { zoom: 1, duration: 400 })
  }

  // A note from the vending machine lands next to what you have selected, or in the middle of the view.
  function placeNote(note: Spark): { text: string; error?: boolean } {
    const current = latest.current
    const selected = getNodes().filter((n) => n.selected)
    const anchor = selected.length === 1 ? findNode(current, selected[0].id) : undefined
    const at = anchor ? freeSpotNear(current, { x: anchor.x + 300, y: anchor.y - 40 }) : centreOf(current)
    const result = addNote(current, note, at)
    if (!result.ok) {
      setNotice(result.error)
      return { text: result.error, error: true }
    }
    if (note.category !== 'theme') rememberSeen([note.text])
    commit(current, result.board)
    return { text: `${result.node?.id}: ${note.text}` }
  }

  function vendFromTerminal(row: VendRow): { text: string; error?: boolean } {
    const note = vendNote(row, new Set(board.nodes.map((n) => n.text)), { seen: loadSeen() })
    if (!note) return { text: `the ${row} row is empty: every one of those notes is on this board`, error: true }
    return placeNote(note)
  }

  // Every delete comes through here. If something sits in the middle of a chain, ask first.
  // Returns false when it's waiting for that answer.
  function requestDelete(ids: string[], links: [string, string][] = []): boolean {
    const chains = ids
      .map((id) => ({ id, around: chainAround(withoutLinks(board, links), id) }))
      .filter((c): c is { id: string; around: [string, string] } => !!c.around)
    if (chains.length === 0) {
      applyDelete(ids, links, false)
      return true
    }
    setPendingDelete({ ids, links, chains })
    return false
  }

  function applyDelete(ids: string[], links: [string, string][], reconnect: boolean) {
    const base = withoutLinks(board, links)
    const next = ids.length ? deleteNodes(base, ids, { reconnect }) : base === board ? board : touch(base, new Date())
    if (next !== board) commit(board, next)
  }

  function finishDelete(reconnect: boolean) {
    if (!pendingDelete) return
    applyDelete(pendingDelete.ids, pendingDelete.links, reconnect)
    setPendingDelete(null)
  }

  function pick(id: string) {
    const result = chooseIdea(board, id)
    if (!result.ok) return
    commit(board, result.board)
    if (result.node?.chosen) setShowSummary(true)
  }

  function makeFavouritesBoard(): string {
    const made = favouritesBoard(board)
    if (!made) return 'no favourites on this board yet. try: fav <id>'
    onOpenNew(made)
    return `made ${made.name}`
  }

  function setTheme(text: string) {
    const at = mainTheme(board) ? { x: 0, y: 0 } : board.nodes.length ? centreOf(board) : { x: 0, y: 0 }
    const result = setMainTheme(board, text, at)
    if (result.ok) commit(board, result.board)
  }

  function favourite(id: string) {
    const result = toggleFavourite(board, id)
    if (result.ok) commit(board, result.board)
  }

  function rename(name: string) {
    const clean = cleanText(name).slice(0, MAX_BOARD_NAME)
    if (clean && clean !== board.name) commit(board, touch({ ...board, name: clean }, new Date()))
  }

  // Opens a favourite: on this board it's shown; on another board, that board opens.
  function openFavourite(f: Favourite) {
    if (f.boardId === board.id) show(f.node.id)
    else onOpenBoard(f.boardId, f.node.id)
  }

  // A favourite picked on another board is shown once this board has opened and been laid out.
  useEffect(() => {
    if (!focusId) return
    // Wait for React Flow's own first fit-to-view, or it would undo the pan.
    const timer = setTimeout(() => show(focusId), 150)
    return () => clearTimeout(timer)
    // Only when the board first opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    favourite,
    pick,
    deleteNode: (id) => void requestDelete([id]),
    deleteMany: (ids, links) => void requestDelete(ids, links),
  }

  function handleCommand(input: string): CommandResult {
    // Not a command: it's a thought, so add it as an idea.
    if (!looksLikeCommand(input)) return runAndCommit(input)
    const word = input.trim().toLowerCase().replace(/\s+/g, ' ')
    const [name, id] = word.split(' ')
    if (name === 'delete' || name === 'rm') {
      if (!findNode(board, id)) return { output: [`No node called ${id}`], error: true }
      const text = findNode(board, id)?.text
      return requestDelete([id]) ? { output: [`deleted ${id}: ${text}`] } : { output: [`${id} is in the middle of a chain: answer on the board`] }
    }
    if (word === 'favboard') return { output: [makeFavouritesBoard()] }
    if (word === 'summary') {
      if (!board.nodes.some((n) => n.chosen)) return { output: ['no idea picked yet. try: pick <id>'], error: true }
      setShowSummary(true)
      return { output: ['showing your summary'] }
    }
    if (name === 'pick') {
      if (!findNode(board, id)) return { output: [`No node called ${id}`], error: true }
      pick(id)
      return { output: [findNode(latest.current, id)?.chosen ? `${id} is the one` : `${id} is no longer the one`] }
    }
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
    if (word === 'favs') {
      const all = allFavourites
      if (all.length === 0) return { output: ['no favourites yet. try: fav <id>'] }
      return { output: all.map((f) => `  ♥ ${f.boardId === board.id ? f.node.id.padEnd(4) : '    '} ${f.node.text}  (${f.boardId === board.id ? 'this board' : f.boardName})`) }
    }
    if (word.startsWith('vend')) {
      const [, row, extra] = word.split(/\s+/)
      if (extra || (row && !VEND_ROWS.includes(row as VendRow))) return { output: [`usage: vend [row]. rows: ${VEND_ROWS.join(' ')}`], error: true }
      const r = vendFromTerminal((row as VendRow | undefined) ?? 'surprise')
      return { output: [r.text], error: r.error }
    }
    if (word.startsWith('starting')) {
      const n = Number(word.split(/\s+/)[1])
      if (!Number.isInteger(n) || n < 0 || n > MAX_STARTING_NOTES) return { output: [`usage: starting <0 to ${MAX_STARTING_NOTES}>. now: ${startingNotes}`], error: true }
      onStartingNotes(n)
      return { output: [`new boards will start with ${n} ${n === 1 ? 'note' : 'notes'}`] }
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
    return runAndCommit(input)
  }

  function runAndCommit(input: string): CommandResult {
    const result = runCommand(board, input, { addAt: visibleCentre() })
    if (result.board) commit(board, result.board)
    return result
  }

  // This board's favourites come straight from the board, the rest from storage.
  const allFavourites: Favourite[] = [
    ...board.nodes.filter((n) => n.favourite).map((node) => ({ boardId: board.id, boardName: board.name, node })),
    ...favourites.filter((f) => f.boardId !== board.id),
  ]

  // V opens the machine and Esc closes the drawer, from anywhere but a text box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || (e.target as Element).closest?.('.popup')) return
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        setPanel('machine')
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.vend__key:not(:disabled)')?.focus())
      } else if (e.key === 'Escape' && panel && (e.target as Element).closest?.('.panel')) {
        setPanel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <BoardActionsContext.Provider value={actions}>
      <div className="workspace">
        <nav className="device__rail" aria-label="Device buttons">
          <button type="button" className="device__button" aria-label="Add an idea" title="Add an idea" onClick={() => addAndEdit(visibleCentre())}>
            +
          </button>
          <button
            type="button"
            className={`device__button${panel === 'machine' ? ' device__button--on' : ''}`}
            aria-label="Vending machine"
            aria-pressed={panel === 'machine'}
            title="Vending machine (V)"
            onClick={() => setPanel(panel === 'machine' ? null : 'machine')}
          >
            <PixelShrimp size={26} />
          </button>
          <button type="button" className="device__button" aria-label="Nudge the selected idea" title="Nudge the selected idea (N)" onClick={nudgeSelected}>
            N
          </button>
          <button
            type="button"
            className={`device__button${panel === 'favourites' ? ' device__button--on' : ''}`}
            aria-label="Favourites"
            aria-pressed={panel === 'favourites'}
            title="Favourites from every board"
            onClick={() => setPanel(panel === 'favourites' ? null : 'favourites')}
          >
            <HeartIcon size={14} />
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
            {renaming ? (
              <input
                className="screen__rename"
                aria-label="Board name"
                defaultValue={board.name}
                maxLength={MAX_BOARD_NAME}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                onBlur={(e) => {
                  rename(e.currentTarget.value)
                  setRenaming(false)
                }}
              />
            ) : (
              <>
                <label className="screen__switch">
                  <span className="visually-hidden">Open a board</span>
                  <select value={board.id} onChange={(e) => onOpenBoard(e.target.value)}>
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id === board.id ? board.name : b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="screen__new" aria-label="Rename this board" title="Rename this board" onClick={() => setRenaming(true)}>
                  ✎
                </button>
              </>
            )}
            <button type="button" className="screen__new" onClick={onNewBoard}>
              + new board
            </button>
            <button type="button" className="screen__new" onClick={() => setPanel(panel === 'boards' ? null : 'boards')}>
              my boards
            </button>
            {board.nodes.some((n) => n.chosen) && (
              <button type="button" className="screen__new screen__summary" onClick={() => setShowSummary(true)}>
                my idea ✓
              </button>
            )}
            {notice && (
              <span className="screen__notice" role="status">
                {notice}
              </span>
            )}
          </header>
          <div className="screen__main">
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
              {board.nodes.length === 0 && !askTheme && (
                <div className="board__empty">
                  <p>Start typing your first thoughts, or get a note from the vending machine.</p>
                  <div className="board__empty-actions">
                    <button type="button" className="popup__stick" onClick={() => terminalRef.current?.focus()}>
                      start typing
                    </button>
                    <button type="button" className="popup__back" onClick={() => setPanel('machine')}>
                      open the machine
                    </button>
                    <button type="button" className="popup__back" onClick={() => onThemeAskedAgain()}>
                      set a theme
                    </button>
                  </div>
                </div>
              )}
            </div>
            {panel && (
              <SidePanel
                tab={panel}
                onTab={setPanel}
                onClose={() => setPanel(null)}
                onBoard={new Set(board.nodes.map((n) => n.text))}
                onVend={setVended}
                busy={!!vended}
                boardId={board.id}
                favourites={allFavourites}
                onOpenFavourite={openFavourite}
                onUnfavourite={(f) => (f.boardId === board.id ? favourite(f.node.id) : onUnfavouriteElsewhere(f))}
                onFavouritesBoard={() => void makeFavouritesBoard()}
                boards={boards}
                onOpenBoard={(id) => onOpenBoard(id)}
                onNewBoard={onNewBoard}
                onRenameBoard={onRenameBoard}
                onDeleteBoard={onDeleteBoard}
              />
            )}
            {vended && (
              <NotePopup
                note={vended}
                onStick={() => {
                  placeNote(vended)
                  setVended(null)
                }}
                onPutBack={() => setVended(null)}
              />
            )}
            {(askTheme || themeAgain) && (
              <ThemePrompt
                onTheme={(text) => {
                  setTheme(text)
                  closeTheme()
                }}
                onSkip={closeTheme}
              />
            )}
            {pendingDelete && <ChainPrompt board={board} chains={pendingDelete.chains} onAnswer={finishDelete} onCancel={() => setPendingDelete(null)} />}
            {showSummary && <SummaryPopup board={board} onClose={() => setShowSummary(false)} />}
          </div>
          <Terminal ref={terminalRef} onRun={handleCommand} onComplete={(input) => complete(input, board, boards.length)} />
        </div>
      </div>
    </BoardActionsContext.Provider>
  )
}
