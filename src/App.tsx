import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { BoardsPage } from './components/BoardsPage'
import { Home } from './components/Home'
import { PalettePage } from './components/palette/PalettePage'
import { Workspace } from './components/Workspace'
import type { Board } from './lib/board'
import { MAX_BOARD_NAME } from './lib/board'
import { cleanText, touch } from './lib/boardOps'
import { createBoard } from './lib/sparks/newBoard'
import { CONTENT_CATEGORIES } from './lib/sparks/content'
import type { Spark } from './lib/sparks/deal'
import { KEYS } from './lib/keys'
import { LocalStorageAdapter, withSummary, type BoardSummary } from './lib/storage'

const storage = new LocalStorageAdapter()

// The shrimp prototype loads on its own, so its 3D and animation libraries only download on that page.
const ShrimpPage = lazy(() => import('./components/shrimp/ShrimpPage').then((m) => ({ default: m.ShrimpPage })))

// Pages, kept in the URL hash so they work on GitHub Pages:
//   #/        home page
//   #/new     makes a new, blank board straight away, then shows it
//   #/board   the board you had open last
//   #/boards  all your boards: open, rename, delete
//   #/shrimp  PROTOTYPE: the shrimp token, a chunky spinning pickup
//   #/palette the colour palette: where it came from, contrast checks, dark and light mode
type Route = 'home' | 'new' | 'board' | 'boards' | 'shrimp' | 'palette'
const ROUTES: Record<string, Route> = { '#/new': 'new', '#/board': 'board', '#/boards': 'boards', '#/shrimp': 'shrimp', '#/palette': 'palette' }
const routeFromHash = (): Route => ROUTES[location.hash] ?? 'home'
const go = (route: Route) => {
  location.hash = route === 'home' ? '/' : `/${route}`
}

// Which board you had open last, so coming back brings you to it.
const LAST_BOARD_KEY = KEYS.lastBoard
const rememberOpen = (id: string) => localStorage.setItem(LAST_BOARD_KEY, id)

// A note picked on the home page's machine ("start a board with this"), used once.
function takeStartNote(): Spark[] {
  const saved = sessionStorage.getItem(KEYS.startNote)
  sessionStorage.removeItem(KEYS.startNote)
  try {
    const note = saved ? (JSON.parse(saved) as Spark) : null
    return note && typeof note.text === 'string' && (CONTENT_CATEGORIES as readonly string[]).includes(note.category) ? [note] : []
  } catch {
    return []
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  // The board just made with "+ new board", which asks for a theme first.
  const [freshId, setFreshId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // React's StrictMode runs effects twice in development; this stops that making two boards.
  const creating = useRef(false)

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

  // A new board opens straight away, blank.
  // Boards get a number for a name, so they're easy to tell apart; rename them any time.
  async function create() {
    if (creating.current) return
    creating.current = true
    const list = await storage.listBoards()
    const created = createBoard({ sparks: takeStartNote(), name: `board ${list.length + 1}` })
    try {
      await storage.saveBoard(created)
      rememberOpen(created.id)
      await refreshList()
      setFreshId(created.id)
      setBoard(created)
      // Replace #/new so going back doesn't make another board.
      history.replaceState(null, '', '#/board')
      setRoute('board')
    } catch (e) {
      setError(String(e))
    } finally {
      creating.current = false
    }
  }

  // Visiting #/new (from the home page or "+ new board") makes the board, once the list has loaded.
  const ready = boards !== null
  useEffect(() => {
    if (route === 'new' && ready) void create()
    // Only when the route changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [route, ready])

  // Saves a board made elsewhere (like a favourites board) and opens it.
  async function openNew(made: Board) {
    try {
      await storage.saveBoard(made)
      await refreshList()
      await open(made.id)
    } catch (e) {
      setError(String(e))
    }
  }

  async function renameBoard(id: string, name: string) {
    const clean = cleanText(name).slice(0, MAX_BOARD_NAME)
    if (!clean) return
    if (board?.id === id) return handleChange(touch({ ...board, name: clean }, new Date()))
    const result = await storage.loadBoard(id)
    if (result.status !== 'ok') return
    await storage.saveBoard(touch({ ...result.board, name: clean }, new Date()))
    await refreshList()
  }

  // Deleting the open board moves you to your most recent other board, or the boards page.
  async function deleteBoard(id: string) {
    await storage.deleteBoard(id)
    const list = await refreshList()
    if (board?.id !== id) return
    const next = list[0]
    if (next) await open(next.id)
    else {
      setBoard(null)
      go('boards')
    }
  }

  // Every change to the open board: save it, and update just its line in the board list.
  function handleChange(next: Board) {
    setBoard(next)
    setBoards((list) => withSummary(list ?? [], next))
    storage.saveBoard(next).catch((e: unknown) => setError(String(e)))
  }

  if (boards === null && !error) return null
  const hasBoards = (boards?.length ?? 0) > 0

  if (route === 'home') return <Home hasBoards={hasBoards} />
  if (route === 'palette') return <PalettePage />
  if (route === 'shrimp')
    return (
      <Suspense fallback={null}>
        <ShrimpPage />
      </Suspense>
    )
  if (route === 'boards')
    return <BoardsPage boards={boards ?? []} openId={board?.id} onOpen={(id) => void open(id)} onRename={renameBoard} onDelete={deleteBoard} />

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
        ) : board && route === 'board' ? (
          <ReactFlowProvider key={board.id}>
            <Workspace
              board={board}
              boards={boards ?? []}
              onChange={handleChange}
              onNewBoard={() => go('new')}
              onOpenBoard={open}
              onOpenNew={openNew}
              onDeleteBoard={deleteBoard}
              askTheme={freshId === board.id}
              onThemeAsked={() => setFreshId(null)}
            />
          </ReactFlowProvider>
        ) : (
          <div className="device__screen">
            <p className="screen__message">{route === 'new' ? 'making your board…' : <a href="#/new">start a board →</a>}</p>
          </div>
        )}
      </div>
    </div>
  )
}
