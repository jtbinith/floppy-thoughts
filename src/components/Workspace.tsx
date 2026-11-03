import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { MAX_BOARD_NAME, shown, type Board } from '../lib/board'
import { addLink, addLinkedIdea, addNote, addNudge, addUserNode, chainAround, chooseIdea, cleanText, deleteNodes, editUserNode, findNode, moveNodes, addTheme, themes, toggleFavourite, touch } from '../lib/boardOps'
import { runCommand, type BoardUi, type CommandResult } from '../lib/commands'
import { favouritesBoard } from '../lib/favouritesBoard'
import { FIT_VIEW } from '../lib/flow'
import { complete } from '../lib/complete'
import { pickNudge, type NudgeChoice } from '../lib/nudges/pickNudge'
import { BOX, PLACE, centreOfBox, freeSpotNear, type Rect } from '../lib/placement'
import { tidyPositions } from '../lib/tidy'
import type { Spark } from '../lib/sparks/deal'
import { loadSeen, rememberSeen } from '../lib/sparks/seen'
import { VEND_ROWS, vendNote, type VendRow } from '../lib/sparks/vend'
import type { BoardSummary, Favourite } from '../lib/storage'
import { emptyUndo, pushChange, redo, undo, type UndoState } from '../lib/undo'
import { BoardActionsContext, type BoardActions } from './boardActions'
import { BoardCanvas } from './BoardCanvas'
import { HeartIcon } from './HeartIcon'
import { ThemeToggle } from './ThemeToggle'
import { MenuBar, type Menu, type MenuItem } from './MenuBar'
import { NotePopup } from './NotePopup'
import { Dialog } from './Dialog'
import { ChainPrompt, SummaryPopup, ThemePrompt } from './Prompts'
import { ShrimpIcon } from './ShrimpIcon'
import { SidePanel, type PanelTab } from './SidePanel'
import { Terminal, type TerminalHandle } from './Terminal'
import { KEYS } from '../lib/keys'

type Props = {
  board: Board
  boards: BoardSummary[]
  onChange: (board: Board) => void
  onNewBoard: () => void
  onOpenBoard: (id: string) => void
  // Save and open a board made here (a favourites board).
  onOpenNew: (board: Board) => void
  onDeleteBoard: (id: string) => void
  // A brand-new board asks "got a theme?" first.
  askTheme: boolean
  onThemeAsked: () => void
}

// Whether the drawer is open, and on which tab, is remembered between visits.
const PANEL_KEY = KEYS.panel
const loadPanel = (): PanelTab | null => {
  const saved = localStorage.getItem(PANEL_KEY)
  return saved === 'machine' || saved === 'favourites' || saved === 'commands' ? saved : null
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
  const { board, boards, onChange, onNewBoard, onOpenBoard } = props
  const { onOpenNew, onDeleteBoard, askTheme, onThemeAsked } = props
  const { screenToFlowPosition, getNodes, getEdges, setNodes, setCenter, getZoom, fitView } = useReactFlow()
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
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false)
  // Box numbers only show while you're typing a command, so the board stays calm otherwise.
  const [showIds, setShowIds] = useState(false)
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

  // The part of the board you can see, in board coordinates, so new things land on screen.
  function viewRect(): Rect | undefined {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return undefined
    const margin = 24
    const topLeft = screenToFlowPosition({ x: rect.left + margin, y: rect.top + margin })
    const bottomRight = screenToFlowPosition({ x: rect.right - margin, y: rect.bottom - margin })
    return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y }
  }

  // Somewhere free near `target`, on screen if there's room.
  const spotNear = (on: Board, target: { x: number; y: number }) => freeSpotNear(on, target, viewRect())

  // The nearest free spot to the middle of the visible board.
  function centreOf(on: Board) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return freeSpotNear(on, { x: 0, y: 0 })
    return spotNear(on, screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }))
  }

  // If something landed off screen anyway (the view was full), glide over to it.
  function reveal(at: { x: number; y: number }) {
    const view = viewRect()
    if (!view) return
    const inside = at.x >= view.x && at.y >= view.y && at.x + BOX.width <= view.x + view.width && at.y + BOX.height <= view.y + view.height
    const centre = centreOfBox(at)
    if (!inside) void setCenter(centre.x, centre.y, { zoom: getZoom(), duration: 350 })
  }

  // Tidy: lay the board out organically (see lib/tidy), gliding boxes to their new places.
  // One change, so one undo puts everything back.
  function tidy(): string {
    if (board.nodes.length < 2) return 'nothing to tidy yet'
    const sizes = new Map(getNodes().map((n) => [n.id, { width: n.measured?.width ?? BOX.width, height: n.measured?.height ?? BOX.height }]))
    // A Map from each box's id to where it's going, so each frame looks them up in constant time.
    const targets = new Map(tidyPositions(board, sizes).map((p) => [p.id, p]))
    const from = new Map(board.nodes.map((n) => [n.id, { x: n.x, y: n.y }]))
    const finished = moveNodes(board, [...targets.values()])
    const start = performance.now()
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450
    const ease = (t: number) => 1 - (1 - t) ** 3
    const step = (now: number) => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1
      setNodes((nodes) =>
        nodes.map((n) => {
          const a = from.get(n.id)
          const b = targets.get(n.id)
          if (!a || !b) return n
          return { ...n, position: { x: a.x + (b.x - a.x) * ease(t), y: a.y + (b.y - a.y) * ease(t) } }
        }),
      )
      if (t < 1) requestAnimationFrame(step)
      else commit(board, finished)
    }
    requestAnimationFrame(step)
    return 'tidied the board (undo puts it back)'
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
    const at = spotNear(from, { x: parent.x + PLACE.branch.x, y: parent.y + PLACE.branch.y })
    const result = addLinkedIdea(from, fromId, NEW_IDEA, at)
    if (!result.ok) {
      setNotice(result.error)
      return
    }
    commit(from, result.board)
    setEditingId(result.node?.id ?? null)
    reveal(at)
  }

  // N key, the device button, or `nudge <id>` in the terminal. Returns what happened, for the terminal.
  async function requestNudge(targetId: string, type?: NudgeChoice): Promise<{ text: string; error?: boolean }> {
    const nudge = await pickNudge(latest.current, targetId, { type })
    const current = latest.current
    const target = findNode(current, targetId)
    if (!target) return { text: `Nothing numbered ${shown(targetId)}`, error: true }
    if (!nudge) {
      const message = `${shown(targetId)} is a nudge already. Nudge the idea or note it's about instead.`
      setNotice(message)
      return { text: message, error: true }
    }
    const at = spotNear(current, { x: target.x + PLACE.nudge.x, y: target.y + PLACE.nudge.y })
    const result = addNudge(current, targetId, nudge, at)
    if (!result.ok) {
      setNotice(result.error)
      return { text: result.error, error: true }
    }
    commit(current, result.board)
    reveal(at)
    return { text: `${shown(result.node?.id)} (${nudge.type}): ${nudge.text}` }
  }

  function nudgeSelected() {
    const selected = getNodes().filter((n) => n.selected)
    if (selected.length !== 1) {
      setNotice('Select one idea first, then press N (or its nudge button) for a nudge.')
      return
    }
    void requestNudge(selected[0].id)
  }

  // Shows a node: selects it and pans the board to it.
  function show(id: string, on: Board = board) {
    const node = findNode(on, id)
    if (!node) return
    setNodes((nodes) => nodes.map((n) => ({ ...n, selected: n.id === id })))
    const centre = centreOfBox(node)
    void setCenter(centre.x, centre.y, { zoom: 1, duration: 400 })
  }

  // A note from the vending machine lands next to what you have selected, or in the middle of the view.
  function placeNote(note: Spark): { text: string; error?: boolean } {
    const current = latest.current
    const selected = getNodes().filter((n) => n.selected)
    const anchor = selected.length === 1 ? findNode(current, selected[0].id) : undefined
    const at = anchor ? spotNear(current, { x: anchor.x + PLACE.note.x, y: anchor.y + PLACE.note.y }) : centreOf(current)
    const result = addNote(current, note, at)
    if (!result.ok) {
      setNotice(result.error)
      return { text: result.error, error: true }
    }
    if (note.category !== 'theme') rememberSeen([note.text])
    commit(current, result.board)
    reveal(at)
    return { text: `${shown(result.node?.id)}: ${note.text}` }
  }

  // `vend` in the terminal brings up the same popup as the machine.
  function vendFromTerminal(row: VendRow): { text: string; error?: boolean } {
    const note = vendNote(row, new Set(board.nodes.map((n) => n.text)), { seen: loadSeen() })
    if (!note) return { text: `the ${row} row is empty: every one of those notes is on this board`, error: true }
    setVended(note)
    return { text: 'a shrimp is on its way…' }
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
    if (!made) return 'no favourites on this board yet. try /fav <id>'
    onOpenNew(made)
    return `made ${made.name}`
  }

  // Adds one or more themes. The first on an empty board goes in the middle; each one after sits
  // beside the last theme. All in one go, so one undo takes them all back.
  function addThemes(texts: string[]) {
    let next = board
    for (const text of texts) {
      const last = themes(next).at(-1)
      const at = last
        ? spotNear(next, { x: centreOfBox(last).x + BOX.width + 40, y: centreOfBox(last).y })
        : next.nodes.length
          ? centreOf(next)
          : { x: 0, y: 0 }
      const result = addTheme(next, text, at)
      if (result.ok) next = result.board
    }
    if (next !== board) commit(board, next)
  }

  function favourite(id: string) {
    const result = toggleFavourite(board, id)
    if (result.ok) commit(board, result.board)
  }

  function rename(name: string) {
    const clean = cleanText(name).slice(0, MAX_BOARD_NAME)
    if (clean && clean !== board.name) commit(board, touch({ ...board, name: clean }, new Date()))
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
    favourite,
    pick,
    deleteNode: (id) => void requestDelete([id]),
    deleteMany: (ids, links) => void requestDelete(ids, links),
  }

  // What the board on screen does for commands that need more than the board itself.
  const ui: BoardUi = {
    undo: stepBack,
    redo: stepForward,
    tidy,
    fit: () => {
      void fitView(FIT_VIEW)
      return board.nodes.length ? 'fitted the board to the screen' : 'the board is empty'
    },
    showCommands: () => setPanel('commands'),
    newBoard: onNewBoard,
    boards: () => boards.map((b) => ({ name: b.id === board.id ? board.name : b.name, open: b.id === board.id })),
    openBoard: (n) => {
      const target = boards[n - 1]
      if (!target) return null
      onOpenBoard(target.id)
      return target.name
    },
    remove: (id) => {
      const text = findNode(board, id)?.text
      return requestDelete([id]) ? `deleted ${shown(id)}: ${text}` : `${shown(id)} is in the middle of a chain: answer on the board`
    },
    showSummary: () => {
      setShowSummary(true)
      return true
    },
    favouritesBoard: makeFavouritesBoard,
    vend: (row) => {
      if (row && !VEND_ROWS.includes(row as VendRow)) return { text: `there's no ${row} row. rows: ${VEND_ROWS.join(' ')}`, error: true }
      return vendFromTerminal((row as VendRow | undefined) ?? 'surprise')
    },
    nudge: (id, type) => void requestNudge(id, type as NudgeChoice | undefined).then((r) => terminalRef.current?.print([r.text], r.error)),
  }

  // Every line from the terminal goes through the one command router.
  function handleCommand(input: string): CommandResult {
    const result = runCommand(board, input, { addAt: visibleCentre(), ui })
    if (result.board) commit(board, result.board)
    result.then?.()
    return result
  }

  // The favourites tab shows this board's favourites.
  const boardFavourites: Favourite[] = board.nodes.filter((n) => n.favourite).map((node) => ({ boardId: board.id, boardName: board.name, node }))

  // Esc in the terminal: the keyboard goes to the board, on whatever is selected (usually what you
  // just added), so Delete, Tab, N and F work on it straight away.
  function focusBoard() {
    const target = boardRef.current?.querySelector<HTMLElement>('.react-flow__node.selected') ?? boardRef.current?.querySelector<HTMLElement>('.react-flow')
    target?.focus()
  }

  // Delete whatever is selected on the board (the Edit menu; the Delete key does the same).
  function deleteSelected() {
    const ids = getNodes().filter((n) => n.selected).map((n) => n.id)
    const links = getEdges()
      .filter((e) => e.selected)
      .map((e): [string, string] => [e.source, e.target])
    if (ids.length || links.length) requestDelete(ids, links)
    else setNotice('Select something on the board first.')
  }

  const hasFavourites = board.nodes.some((n) => n.favourite)
  const recentBoards = boards.filter((b) => b.id !== board.id).slice(0, 5)
  const menus: Menu[] = [
    {
      label: 'Board',
      items: [
        { label: 'New board', onSelect: onNewBoard },
        { label: 'Rename…', onSelect: () => setRenaming(true) },
        'divider',
        // Recent boards, one click to switch (like VS Code's Open Recent).
        ...recentBoards.map((b): MenuItem => ({ label: b.name, onSelect: () => onOpenBoard(b.id) })),
        { label: 'All boards…', onSelect: () => (location.hash = '/boards') },
        'divider',
        { label: 'Favourites on a new board', onSelect: () => void makeFavouritesBoard(), disabled: !hasFavourites },
        { label: 'My idea', onSelect: () => setShowSummary(true), disabled: !board.nodes.some((n) => n.chosen) },
        'divider',
        { label: 'Delete this board…', onSelect: () => setConfirmDeleteBoard(true) },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', onSelect: () => void stepBack() },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', onSelect: () => void stepForward() },
        'divider',
        { label: 'Add an idea', shortcut: 'double-click', onSelect: () => addAndEdit(visibleCentre()) },
        { label: 'Add a theme…', onSelect: () => setThemeAgain(true) },
        { label: 'Nudge the selected idea', shortcut: 'N', onSelect: nudgeSelected },
        { label: 'Delete selected', shortcut: 'Delete', onSelect: deleteSelected },
        'divider',
        { label: 'Tidy the board', onSelect: () => void tidy(), disabled: board.nodes.length < 2 },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Vending machine', shortcut: 'V', onSelect: () => setPanel('machine') },
        { label: 'Favourites', onSelect: () => setPanel('favourites') },
        { label: 'Commands', onSelect: () => setPanel('commands') },
        { label: 'Close the drawer', shortcut: 'Esc', onSelect: () => setPanel(null), disabled: !panel },
        'divider',
        { label: 'Terminal', shortcut: 'Ctrl+`', onSelect: () => terminalRef.current?.focus() },
        { label: 'Fit the board to the screen', onSelect: () => void fitView(FIT_VIEW) },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Commands', onSelect: () => setPanel('commands') },
        { label: 'Keyboard shortcuts', onSelect: () => setPanel('commands') },
      ],
    },
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
        {/* In the order you work: add a thought, get a note, look back at favourites, then help. */}
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
            <ShrimpIcon size={24} />
          </button>
          <button
            type="button"
            className={`device__button${panel === 'favourites' ? ' device__button--on' : ''}`}
            aria-label="Favourites"
            aria-pressed={panel === 'favourites'}
            title="This board's favourites"
            onClick={() => setPanel(panel === 'favourites' ? null : 'favourites')}
          >
            <HeartIcon size={14} />
          </button>
          <button
            type="button"
            className={`device__button${panel === 'commands' ? ' device__button--on' : ''}`}
            aria-label="Commands"
            aria-pressed={panel === 'commands'}
            title="Commands"
            onClick={() => setPanel(panel === 'commands' ? null : 'commands')}
          >
            ?
          </button>
        </nav>

        <div className="device__screen">
          <header className="screen__bar">
            <MenuBar menus={menus} />
            {/* The board's name sits in the middle, like a window title. Click to rename. */}
            <div className="screen__name">
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
                <button type="button" className="screen__name-button" title="Rename this board" onClick={() => setRenaming(true)}>
                  {board.name}
                </button>
              )}
            </div>
            <div className="screen__end">
              <ThemeToggle className="theme-toggle--bar" />
              {notice && (
                <span className="screen__notice" role="status">
                  {notice}
                </span>
              )}
              {board.nodes.some((n) => n.chosen) && (
                <button type="button" className="screen__new screen__summary" onClick={() => setShowSummary(true)}>
                  my idea ✓
                </button>
              )}
            </div>
          </header>
          <div className="screen__main">
            <div className={`workspace__board${showIds ? ' workspace__board--ids' : ''}`} ref={boardRef}>
              <BoardCanvas
                board={board}
                onChange={(next) => commit(board, next)}
                onAddAt={addAndEdit}
                onTidy={() => void tidy()}
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
                favourites={boardFavourites}
                onOpenFavourite={(f) => show(f.node.id)}
                onUnfavourite={(f) => favourite(f.node.id)}
                onFavouritesBoard={() => void makeFavouritesBoard()}
                onUseCommand={(command) => terminalRef.current?.fill(command)}
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
                first={themes(board).length === 0}
                onThemes={(texts) => {
                  addThemes(texts)
                  closeTheme()
                }}
                onSkip={closeTheme}
              />
            )}
            {pendingDelete && <ChainPrompt board={board} chains={pendingDelete.chains} onAnswer={finishDelete} onCancel={() => setPendingDelete(null)} />}
            {showSummary && <SummaryPopup board={board} onClose={() => setShowSummary(false)} />}
            {confirmDeleteBoard && (
              <Dialog label="Delete this board?" onCancel={() => setConfirmDeleteBoard(false)}>
                <h2 className="dialog__title">Delete &quot;{board.name}&quot;?</h2>
                <p className="dialog__text">Everything on it goes, and this can&apos;t be undone.</p>
                <div className="popup__actions">
                  <button type="button" className="popup__back" onClick={() => setConfirmDeleteBoard(false)} autoFocus>
                    keep it
                  </button>
                  <button
                    type="button"
                    className="popup__stick popup__danger"
                    onClick={() => {
                      setConfirmDeleteBoard(false)
                      onDeleteBoard(board.id)
                    }}
                  >
                    delete board
                  </button>
                </div>
              </Dialog>
            )}
          </div>
          <Terminal
            ref={terminalRef}
            onRun={handleCommand}
            onComplete={(input) => complete(input, board, boards.length)}
            onEscape={focusBoard}
            onCommandMode={setShowIds}
          />
        </div>
      </div>
    </BoardActionsContext.Provider>
  )
}
