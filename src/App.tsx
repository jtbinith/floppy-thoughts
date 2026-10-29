import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Home } from './components/Home'
import { StartScreen, type NewBoardRequest } from './components/StartScreen'
import { Workspace } from './components/Workspace'
import type { Board } from './lib/board'
import { createBoard } from './lib/sparks/newBoard'
import { rememberSeen } from './lib/sparks/seen'
import { LocalStorageAdapter, type BoardSummary } from './lib/storage'

const storage = new LocalStorageAdapter()

// Pages, kept in the URL hash so they work on GitHub Pages:
//   #/       home page
//   #/new    new-board screen
//   #/board  the board you had open last
type Route = 'home' | 'new' | 'board'
const routeFromHash = (): Route => (location.hash === '#/new' ? 'new' : location.hash === '#/board' ? 'board' : 'home')
const go = (route: Route) => {
  location.hash = route === 'home' ? '/' : `/${route}`
}

// Which board you had open last, so coming back brings you to it.
const LAST_BOARD_KEY = 'hunchhack:ui:last-board'
const rememberOpen = (id: string) => localStorage.setItem(LAST_BOARD_KEY, id)

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  async function refreshList() {
    const list = await storage.listBoards()
    setBoards(list)
    return list
  }

  async function open(id: string) {
    const result = await storage.loadBoard(id)
    if (result.status === 'ok') {
      rememberOpen(id)
      setBoard(result.board)
      go('board')
    } else setError(result.status === 'invalid' ? `That board couldn't be opened: ${result.errors[0]}` : 'Board not found')
  }

  // Load the board list once, and open the last board if the URL asks for it.
  useEffect(() => {
    let cancelled = false
    storage.listBoards().then(
      async (list) => {
        if (cancelled) return
        setBoards(list)
        const last = list.find((b) => b.id === localStorage.getItem(LAST_BOARD_KEY)) ?? list[0]
        if (!last) return
        const result = await storage.loadBoard(last.id)
        if (!cancelled && result.status === 'ok') setBoard(result.board)
      },
      (e: unknown) => !cancelled && setError(String(e)),
    )
    return () => {
      cancelled = true
    }
  }, [])

  async function create(request: NewBoardRequest) {
    const sparks = request.sparks
    // Boards without a theme or name get a number, so they're easy to tell apart.
    const created = createBoard({
      sparks,
      theme: request.theme,
      name: request.name || (request.theme ? undefined : `board ${(boards?.length ?? 0) + 1}`),
    })
    try {
      await storage.saveBoard(created)
      rememberSeen(sparks.map((s) => s.text))
      rememberOpen(created.id)
      await refreshList()
      setBoard(created)
      go('board')
    } catch (e) {
      setError(String(e))
    }
  }

  function handleChange(next: Board) {
    setBoard(next)
    storage
      .saveBoard(next)
      .then(refreshList)
      .catch((e: unknown) => setError(String(e)))
  }

  if (boards === null && !error) return null
  const hasBoards = (boards?.length ?? 0) > 0

  if (route === 'home') return <Home hasBoards={hasBoards} />

  // No board to show yet: go to the new-board screen instead.
  const showStart = route === 'new' || !board

  return (
    <div className="page">
      <a className="device__label" href="#/">
        Floppy Thoughts<small>ideas worth hacking on</small>
      </a>
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
        ) : showStart ? (
          <StartScreen onCreate={create} onCancel={board ? () => go('board') : undefined} />
        ) : (
          board && (
            <ReactFlowProvider key={board.id}>
              <Workspace
                board={board}
                boards={boards ?? []}
                onChange={handleChange}
                onNewBoard={() => go('new')}
                onOpenBoard={open}
              />
            </ReactFlowProvider>
          )
        )}
      </div>
    </div>
  )
}
