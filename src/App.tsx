import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { BoardsPage } from './components/BoardsPage'
import { Home } from './components/Home'
import { PalettePage } from './components/palette/PalettePage'
import { Workspace } from './components/Workspace'
import type { Board } from './lib/board'
import { MAX_BOARD_NAME, parseBoard } from './lib/board'
import { cleanText, touch } from './lib/boardOps'
import { applyChange, changeBetween, isEmpty, onlyFavourites, type BoardChange } from './lib/changes'
import { createBoard } from './lib/sparks/newBoard'
import { CONTENT_CATEGORIES } from './lib/sparks/content'
import type { Spark } from './lib/sparks/deal'
import { KEYS } from './lib/keys'
import { LocalStorageAdapter, withSummary, type BoardSummary, type StorageAdapter } from './lib/storage'
import { useAccount } from './lib/account/account'
import { supabase } from './lib/account/supabase'
import { SupabaseStorage } from './lib/account/supabaseStorage'
import type { SyncState } from './lib/account/outbox'
import { moveBrowserBoards } from './lib/account/upload'
import { myRole, type Role } from './lib/account/sharing'
import { joinLive, type Here, type Live } from './lib/account/live'
import { JoinPage } from './components/JoinPage'

// Boards in this browser. Signed in, boards live in your account instead (SupabaseStorage).
const browser = new LocalStorageAdapter()

// The shrimp prototype loads on its own, so its 3D and animation libraries only download on that page.
const ShrimpPage = lazy(() => import('./components/shrimp/ShrimpPage').then((m) => ({ default: m.ShrimpPage })))

// Pages, kept in the URL hash so they work on GitHub Pages:
//   #/        home page
//   #/new     makes a new, blank board straight away, then shows it
//   #/board   the board you had open last
//   #/boards  all your boards: open, rename, delete
//   #/shrimp  PROTOTYPE: the shrimp token, a chunky spinning pickup
//   #/palette the colour palette: where it came from, contrast checks, dark and light mode
//   #/join/…  an invite link: joins the board it's for (after signing in)
type Route = 'home' | 'new' | 'board' | 'boards' | 'shrimp' | 'palette' | 'join'
const ROUTES: Record<string, Route> = { '#/new': 'new', '#/board': 'board', '#/boards': 'boards', '#/shrimp': 'shrimp', '#/palette': 'palette' }
const routeFromHash = (): Route => (location.hash.startsWith('#/join/') ? 'join' : (ROUTES[location.hash] ?? 'home'))
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
  // Signed in, boards are saved to your account; signed out, in this browser.
  const { account, ready: signInKnown } = useAccount()
  const accountId = account?.id
  const storage: StorageAdapter = useMemo(() => (accountId && supabase ? new SupabaseStorage(supabase, accountId) : browser), [accountId])
  // Signed in: whether changes are waiting to reach your account, and whether you're offline.
  const [sync, setSync] = useState<SyncState>({ waiting: 0, offline: false })
  useEffect(() => {
    if (!(storage instanceof SupabaseStorage)) return
    setSync(storage.sync)
    return storage.onSync(setSync)
  }, [storage])
  // Your role on the open board, when it's in your account.
  const [roles, setRoles] = useState<Record<string, Role | null>>({})
  const role: Role | null = (board && roles[board.id]) ?? null
  const boardId = board?.id
  useEffect(() => {
    if (!accountId || !boardId) return
    let gone = false
    myRole(boardId, accountId).then(
      (r) => !gone && setRoles((all) => ({ ...all, [boardId]: r })),
      () => {},
    )
    return () => {
      gone = true
    }
  }, [accountId, boardId])

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

  // Load the board list, and open the last board if the URL asks for it. Again whenever you sign
  // in or out; the first time you sign in, this browser's boards move to your account first.
  useEffect(() => {
    if (!signInKnown) return
    let cancelled = false
    setBoard(null)
    const moving = accountId ? moveBrowserBoards(browser, storage, accountId) : Promise.resolve(0)
    moving.then(() => storage.listBoards()).then(
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
  }, [signInKnown, accountId, storage])

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

  // Every change to the open board: save what it touched, and update just its line in the board list.
  // `saved` is the board as last saved, so two changes before React re-renders each send only their own.
  const saved = useRef<Board | null>(null)

  // Bringing the open board up to date with the database: when someone else's change is
  // announced live, and when you're back online. What changed is read from the database (plus
  // your own changes still on their way) and merged in box by box, into your undo history too, so
  // undo only takes back your own. Announcements that arrive mid-read lead to one more read.
  const [remote, setRemote] = useState<{ change: BoardChange; n: number } | null>(null)
  const reading = useRef<{ busy: boolean; again: boolean }>({ busy: false, again: false })
  async function catchUp(id: string) {
    if (reading.current.busy) {
      reading.current.again = true
      return
    }
    reading.current = { busy: true, again: false }
    try {
      const before = saved.current
      const result = await storage.loadBoard(id)
      if (result.status !== 'ok' || before?.id !== id) return
      const theirs = changeBetween(before, result.board)
      if (isEmpty(theirs)) return
      // Onto the board as it is now, so anything you did while reading stays.
      const merge = (b: Board) => {
        const next = applyChange(b, theirs)
        return parseBoard(next).ok ? next : b
      }
      if (saved.current?.id === id) saved.current = merge(saved.current)
      setBoard((b) => (b?.id === id ? merge(b) : b))
      setRemote((r) => ({ change: theirs, n: (r?.n ?? 0) + 1 }))
    } finally {
      const again = reading.current.again
      reading.current = { busy: false, again: false }
      if (again) void catchUp(id)
    }
  }

  // A board in your account is live, and you can see who else has it open.
  const live = useRef<Live | null>(null)
  const [here, setHere] = useState<Here[]>([])
  const onShared = role !== null
  useEffect(() => {
    if (!account || !boardId || !onShared) return
    const channel = joinLive(boardId, account, { onChanged: () => void catchUp(boardId), onHere: setHere })
    live.current = channel
    return () => {
      channel?.leave()
      live.current = null
      setHere([])
    }
    // Once per board, per account.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, boardId, onShared])

  // Back online, with everything of yours sent: catch up on what others changed meanwhile.
  const wasOffline = useRef(false)
  useEffect(() => {
    const backOnline = wasOffline.current && !sync.offline && sync.waiting === 0
    wasOffline.current = sync.offline
    if (backOnline && boardId) void catchUp(boardId)
    // When the connection comes back.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.offline, sync.waiting])

  function handleChange(next: Board) {
    const before = saved.current?.id === next.id ? saved.current : board?.id === next.id ? board : null
    const change = changeBetween(before, next)
    // A viewer can favourite, nothing else (the database would refuse it anyway).
    if (role === 'viewer' && before && !onlyFavourites(before, change)) return
    saved.current = next
    setBoard(next)
    setBoards((list) => withSummary(list ?? [], next))
    // Saved first, then announced, so everyone else reads it from the database.
    storage
      .saveChange(next, change)
      .then(() => live.current?.changed())
      .catch((e: unknown) => setError(String(e)))
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
  if (route === 'join')
    return (
      <JoinPage
        secret={location.hash.slice('#/join/'.length)}
        signedIn={!!accountId}
        ready={signInKnown}
        onJoined={async (id) => {
          await refreshList()
          await open(id)
        }}
      />
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
              role={role}
              remote={remote}
              here={here}
              sync={sync}
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
