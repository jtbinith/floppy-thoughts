import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { isFavourite, type Board } from '../lib/board'
import { addLink, findNode, themes } from '../lib/boardOps'
import { runCommand, type CommandResult } from '../lib/commands'
import { FIT_VIEW } from '../lib/flow'
import { complete } from '../lib/complete'
import type { MachineControl } from './machine/HomeMachine'
import type { BoardSummary, Favourite } from '../lib/storage'
import { useBoardHistory } from './workspace/useBoardHistory'
import { workspaceMenus } from './workspace/workspaceMenus'
import { terminalUi } from './workspace/terminalUi'
import { useBoardView } from './workspace/useBoardView'
import { NEW_IDEA, useBoardEdits } from './workspace/useBoardEdits'
import { isTyping } from './workspace/isTyping'
import { BoardActionsContext, type BoardActions } from './boardActions'
import { BoardCanvas } from './BoardCanvas'
import { HeartIcon } from './HeartIcon'
import { ScreenBar } from './workspace/ScreenBar'
import { Dialog } from './Dialog'
import { KeysSheet } from './KeysSheet'
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
  // Save and open a board made here (a favourited board).
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

// The board plus the terminal. Both edit the same board through the same operations.
export function Workspace(props: Props) {
  const { board, boards, onChange, onNewBoard, onOpenBoard } = props
  const { onOpenNew, onDeleteBoard, askTheme, onThemeAsked } = props
  const { getNodes, getEdges, fitView } = useReactFlow()
  const [panel, setPanelState] = useState<PanelTab | null>(loadPanel)
  const [renaming, setRenaming] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
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
  // Notices fade after a few seconds.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  // Saving changes, undo and redo.
  const { commit, stepBack, stepForward, latest } = useBoardHistory(board, onChange, () => setEditingId(null))

  // Where things go on screen: free spots, gliding to a box, tidying, where a note lands.
  const { spotNear, centreOf, reveal, show, noteSpot, noteLanding, tidy } = useBoardView({ board, boardRef, latest, commit })
  const visibleCentre = () => centreOf(board)

  // Every change to the board: adding, editing, branching, nudges, notes, themes, deleting.
  const edits = useBoardEdits({
    board,
    latest,
    commit,
    onChange,
    view: { spotNear, centreOf, reveal, noteSpot },
    say: setNotice,
    edit: setEditingId,
    onOpenNew,
  })
  const { addAndEdit, branchFrom, requestNudge, nudgeSelected, placeNote, requestDelete, makeFavouritesBoard, addThemes, favourite, rename, saveEdit } = edits

  // The machine in the drawer hands over its controls, so the terminal can run it.
  const machineControl = useRef<MachineControl | null>(null)

  // Opens the drawer on the machine and focuses it, so you can type a row straight away (it may
  // still be loading, so it tries for a moment).
  function openMachine() {
    setPanel('machine')
    let tries = 0
    const focusMachine = () => {
      const machine = document.querySelector<HTMLElement>('.panel__machine .home__machine')
      if (machine) machine.focus()
      else if (tries++ < 40) setTimeout(focusMachine, 50)
    }
    focusMachine()
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
    deleteNode: (id) => void requestDelete([id]),
    deleteMany: (ids, links) => void requestDelete(ids, links),
    undo: () => void stepBack(),
    redo: () => void stepForward(),
    addIdea: () => addAndEdit(visibleCentre()),
    say: setNotice,
    showKeys: () => setShowKeys(true),
  }

  // What the board on screen does for terminal commands that need more than the board itself.
  // Made when a command runs (not while drawing), since it reaches into the terminal and machine.
  const makeUi = () => terminalUi({
    board,
    boards,
    stepBack,
    stepForward,
    tidy,
    fit: () => void fitView(FIT_VIEW),
    openPanel: setPanel,
    onNewBoard,
    onOpenBoard,
    requestDelete,
    showSummary: () => setShowSummary(true),
    makeFavouritesBoard,
    machine: () => machineControl.current,
    requestNudge,
    print: (lines, error) => terminalRef.current?.print(lines, error),
  })

  // Every line from the terminal goes through the one command router.
  function handleCommand(input: string): CommandResult {
    const result = runCommand(board, input, { addAt: visibleCentre(), ui: makeUi() })
    if (result.board) commit(board, result.board)
    result.then?.()
    return result
  }

  // The favourites tab shows this board's favourites.
  const boardFavourites: Favourite[] = board.nodes.filter(isFavourite).map((node) => ({ boardId: board.id, boardName: board.name, node }))

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

  function focusTerminal() {
    terminalRef.current?.focus()
  }

  // The linter can't tell these handlers only run on a click (some reach into the terminal), so
  // it warns about refs here; nothing reads a ref while drawing.
  // oxlint-disable-next-line react/refs
  const menus = workspaceMenus({
    board,
    boards,
    panel,
    newBoard: onNewBoard,
    rename: () => setRenaming(true),
    openBoard: onOpenBoard,
    favouritesBoard: () => void makeFavouritesBoard(),
    showIdea: () => setShowSummary(true),
    deleteBoard: () => setConfirmDeleteBoard(true),
    undo: () => void stepBack(),
    redo: () => void stepForward(),
    addIdea: () => addAndEdit(visibleCentre()),
    addTheme: () => setThemeAgain(true),
    nudge: nudgeSelected,
    deleteSelected,
    tidy: () => void tidy(),
    openMachine,
    openPanel: setPanel,
    focusTerminal,
    fit: () => void fitView(FIT_VIEW),
    showKeys: () => setShowKeys(true),
  })

  // V opens the machine and Esc closes the drawer, from anywhere but a text box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || (e.target as Element).closest?.('.popup')) return
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        openMachine()
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
        {/* In the order you work: add a thought, get a note, look back at what you favourited, then help. */}
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
            onClick={() => (panel === 'machine' ? setPanel(null) : openMachine())}
          >
            <ShrimpIcon size={24} />
          </button>
          <button
            type="button"
            className={`device__button${panel === 'favourites' ? ' device__button--on' : ''}`}
            aria-label="Favourites"
            aria-pressed={panel === 'favourites'}
            title="What you favourited on this board"
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
          <ScreenBar
            menus={menus}
            board={board}
            renaming={renaming}
            onRenaming={setRenaming}
            onRename={rename}
            notice={notice}
            onShowIdea={() => setShowSummary(true)}
          />
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
                onStick={(note, at) => void placeNote(note, at)}
                noteLanding={noteLanding}
                onMachineControl={(control) => void (machineControl.current = control)}
                boardId={board.id}
                favourites={boardFavourites}
                onOpenFavourite={(f) => show(f.node.id)}
                onUnfavourite={(f) => favourite(f.node.id)}
                onFavouritesBoard={() => void makeFavouritesBoard()}
                onUseCommand={(command) => terminalRef.current?.fill(command)}
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
            {edits.pendingDelete && <ChainPrompt board={board} chains={edits.pendingDelete.chains} onAnswer={edits.finishDelete} onCancel={edits.cancelDelete} />}
            {showKeys && <KeysSheet onClose={() => setShowKeys(false)} />}
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
