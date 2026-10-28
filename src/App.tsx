import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { StartScreen, type NewBoardRequest } from './components/StartScreen'
import { Workspace } from './components/Workspace'
import type { Board } from './lib/board'
import { dealSparks } from './lib/sparks/deal'
import { createBoard } from './lib/sparks/newBoard'
import { loadSeen, rememberSeen } from './lib/sparks/seen'
import { LocalStorageAdapter, type BoardSummary } from './lib/storage'

const storage = new LocalStorageAdapter()

type View = { kind: 'loading' } | { kind: 'start' } | { kind: 'board'; board: Board }

// Which board you had open last, so a refresh brings you back to it.
const LAST_BOARD_KEY = 'hunchhack:ui:last-board'
const rememberOpen = (id: string) => localStorage.setItem(LAST_BOARD_KEY, id)

export default function App() {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  async function refreshList() {
    const list = await storage.listBoards()
    setBoards(list)
    return list
  }

  async function open(id: string) {
    const result = await storage.loadBoard(id)
    if (result.status === 'ok') {
      rememberOpen(id)
      setView({ kind: 'board', board: result.board })
    } else setError(result.status === 'invalid' ? `That board couldn't be opened: ${result.errors[0]}` : 'Board not found')
  }

  // First visit: the new-board screen. After that: the board you had open last.
  useEffect(() => {
    let cancelled = false
    storage.listBoards().then(
      async (list) => {
        if (cancelled) return
        setBoards(list)
        if (!list[0]) return setView({ kind: 'start' })
        const last = localStorage.getItem(LAST_BOARD_KEY)
        const result = await storage.loadBoard(list.some((b) => b.id === last) ? last! : list[0].id)
        if (!cancelled) setView(result.status === 'ok' ? { kind: 'board', board: result.board } : { kind: 'start' })
      },
      (e: unknown) => !cancelled && setError(String(e)),
    )
    return () => {
      cancelled = true
    }
  }, [])

  async function create(request: NewBoardRequest) {
    const seen = loadSeen()
    const sparks = dealSparks(request.theme ? 2 : 3, { seen })
    // Boards without a theme or name get a number, so they're easy to tell apart.
    const board = createBoard({ sparks, theme: request.theme, name: request.name || (request.theme ? undefined : `board ${boards.length + 1}`) })
    try {
      await storage.saveBoard(board)
      rememberSeen(sparks.map((s) => s.text))
      rememberOpen(board.id)
      await refreshList()
      setView({ kind: 'board', board })
    } catch (e) {
      setError(String(e))
    }
  }

  function handleChange(next: Board) {
    setView({ kind: 'board', board: next })
    storage
      .saveBoard(next)
      .then(refreshList)
      .catch((e: unknown) => setError(String(e)))
  }

  const current = view.kind === 'board' ? view.board : null

  return (
    <div className="page">
      <div className="device__label">
        HunchHack<small>ideas worth hacking on</small>
      </div>
      <div className="device">
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <span key={corner} className={`device__screw device__screw--${corner}`} aria-hidden="true" />
        ))}
        {error ? (
          <div className="device__screen">
            <p className="screen__message" role="alert">
              {error}
            </p>
          </div>
        ) : view.kind === 'loading' ? (
          <div className="device__screen">
            <p className="screen__message">Loading…</p>
          </div>
        ) : view.kind === 'start' ? (
          <StartScreen onCreate={create} onCancel={boards[0] ? () => open(boards[0].id) : undefined} />
        ) : (
          current && (
            <ReactFlowProvider key={current.id}>
              <Workspace
                board={current}
                boards={boards}
                onChange={handleChange}
                onNewBoard={() => setView({ kind: 'start' })}
                onOpenBoard={open}
              />
            </ReactFlowProvider>
          )
        )}
      </div>
    </div>
  )
}
