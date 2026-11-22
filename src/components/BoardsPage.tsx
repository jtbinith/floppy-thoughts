import { useCallback, useEffect, useState } from 'react'
import { SORTS, findBoards, isSort, type Sort } from '../lib/findBoards'
import {
  NO_FOLDERS,
  boardsInside,
  canMoveFolder,
  deleteFolder,
  folderById,
  folderOf,
  forgetBoards,
  foldersIn,
  makeFolder,
  moveFolder,
  pathTo,
  placeBoard,
  renameFolder,
  type Folders,
} from '../lib/folders'
import type { FolderStore } from '../lib/folderStore'
import { KEYS } from '../lib/keys'
import type { BoardSummary } from '../lib/storage'
import { BoardList } from './BoardList'
import { Dialog } from './Dialog'
import { FolderCards, MoveTargets } from './FolderCards'
import { DRAGGED, countOf, dragData, type Dragged } from './folderDrag'
import { NavBar } from './NavBar'
import { SiteFooter } from './InfoPages'

// All your boards on their own page, outside the device (like the home page), in your folders.
type Props = {
  boards: BoardSummary[]
  openId?: string
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void | Promise<void>
  folderStore: FolderStore
}

const savedSort = (): Sort => {
  const value = localStorage.getItem(KEYS.boardSort)
  return isSort(value) ? value : 'edited'
}

export function BoardsPage(props: Props) {
  const { boards, folderStore } = props
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>(savedSort)
  const [raw, setRaw] = useState<Folders>(NO_FOLDERS)
  // The folder you're looking at (null: the top), kept while you pop into a board and back.
  const [at, setAtState] = useState<string | null>(() => sessionStorage.getItem(KEYS.boardsFolder))
  const [moving, setMoving] = useState<Dragged | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let gone = false
    folderStore.load().then((f) => !gone && setRaw(f), () => {})
    return () => {
      gone = true
    }
  }, [folderStore])

  // Only boards still on your list count (one deleted or left elsewhere just drops out).
  const onList = new Set(boards.map((b) => b.id))
  const folders = forgetBoards(raw, (id) => onList.has(id))
  const here = at && folderById(folders, at) ? at : null

  const setAt = (id: string | null) => {
    setAtState(id)
    if (id) sessionStorage.setItem(KEYS.boardsFolder, id)
    else sessionStorage.removeItem(KEYS.boardsFolder)
  }

  // Every change: shown straight away, then saved. If saving fails, it's put back as it was.
  const change = useCallback(
    async (next: Folders | null) => {
      if (!next) return false
      const before = raw
      setRaw(next)
      setProblem(null)
      try {
        await folderStore.save(before, next)
        return true
      } catch {
        setRaw(before)
        setProblem("That didn't save. Check your connection and try again.")
        return false
      }
    },
    [raw, folderStore],
  )

  function changeSort(value: string) {
    if (!isSort(value)) return
    setSort(value)
    localStorage.setItem(KEYS.boardSort, value)
  }

  const moveTo = (thing: Dragged, into: string | null) =>
    void change(thing.kind === 'board' ? placeBoard(raw, thing.id, into) : canMoveFolder(raw, thing.id, into) ? moveFolder(raw, thing.id, into) : null)

  async function removeFolder(id: string, keepInside: boolean) {
    const result = deleteFolder(raw, id, keepInside)
    setDeleting(null)
    if (!result) return
    const doomed = result.boards.filter((b) => onList.has(b))
    if (!(await change(result.folders))) return
    if (here && !folderById(result.folders, here)) setAt(folderById(raw, id)?.parentId ?? null)
    for (const b of doomed) await props.onDelete(b)
  }

  const searching = search.trim().length > 0
  const shown = findBoards(searching ? boards : boards.filter((b) => folderOf(folders, b.id) === here), search, sort)
  const path = pathTo(folders, here)
  const whereIs = (id: string) => {
    const p = pathTo(folders, folderOf(folders, id))
    return p.length ? p.map((f) => f.name).join(' / ') : undefined
  }
  const deletingFolder = folderById(folders, deleting)
  const doomedCount = deleting ? boardsInside(folders, deleting).length : 0
  const hasInside = !!deleting && (doomedCount > 0 || foldersIn(folders, deleting).length > 0)

  return (
    <div className="home">
      <NavBar current="boards" />
      <main className="boards-page">
        <h1>my boards</h1>
        <div className="boards-tools">
          <input
            type="search"
            className="boards-tools__search"
            placeholder="search names and thoughts…"
            aria-label="Search boards"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          />
          <button type="button" className="boards-tools__folder" onClick={() => setNaming(true)}>
            <span aria-hidden="true">+</span> new folder
          </button>
          <label className="boards-tools__sort">
            sort by
            <select value={sort} onChange={(e) => changeSort(e.currentTarget.value)}>
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {searching ? (
          <p className="boards-path">searching every folder</p>
        ) : (
          here && (
          <nav className="boards-path" aria-label="Folder">
            <Crumb label="my boards" current={!here} onOpen={() => setAt(null)} onDrop={(thing) => moveTo(thing, null)} />
            {path.map((f) => (
              <span key={f.id} className="boards-path__step">
                <span aria-hidden="true">/</span>
                <Crumb label={f.name} current={f.id === here} onOpen={() => setAt(f.id)} onDrop={(thing) => thing.id !== f.id && moveTo(thing, f.id)} />
              </span>
            ))}
          </nav>
          )
        )}
        {problem && (
          <p className="boards-tools__none" role="alert">
            {problem}
          </p>
        )}

        {!searching && (
          <FolderCards
            folders={folders}
            at={here}
            boardCount={(id) => boardsInside(folders, id).length}
            onOpen={setAt}
            onRename={(id, name) => void change(renameFolder(raw, id, name))}
            onMove={(id) => setMoving({ kind: 'folder', id })}
            onDelete={setDeleting}
            onDrop={moveTo}
          />
        )}
        <BoardList
          {...props}
          boards={shown}
          onMove={(id) => setMoving({ kind: 'board', id })}
          where={searching ? whereIs : undefined}
          onNew={() => (here ? sessionStorage.setItem(KEYS.newBoardFolder, here) : sessionStorage.removeItem(KEYS.newBoardFolder))}
        />
        {searching && shown.length === 0 && <p className="boards-tools__none">No boards match “{search.trim()}”.</p>}
        {!searching && here && shown.length === 0 && foldersIn(folders, here).length === 0 && (
          <p className="boards-tools__none">This folder's empty. Move a board here, or start one.</p>
        )}
      </main>
      <SiteFooter />

      {naming && (
        <Dialog label="New folder" onCancel={() => setNaming(false)}>
          <form
            className="dialog__form"
            onSubmit={(e) => {
              e.preventDefault()
              const name = new FormData(e.currentTarget).get('name')
              void change(makeFolder(raw, String(name ?? ''), here, crypto.randomUUID(), new Date()))
              setNaming(false)
            }}
          >
            <h2 className="dialog__title">New folder</h2>
            <p className="dialog__text">{here ? `Inside ${folderById(folders, here)?.name}.` : 'For a hackathon, a class or a project.'}</p>
            <input className="dialog__input" name="name" aria-label="Folder name" maxLength={80} required autoFocus />
            <div className="popup__actions">
              <button type="submit" className="popup__stick">
                make it
              </button>
              <button type="button" className="popup__back" onClick={() => setNaming(false)}>
                cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {moving && (
        <Dialog label="Move to" onCancel={() => setMoving(null)}>
          <div className="dialog__form">
            <h2 className="dialog__title">Move {nameOf(moving, boards, folders)} to…</h2>
            <MoveTargets
              folders={folders}
              moving={moving}
              current={moving.kind === 'board' ? folderOf(folders, moving.id) : (folderById(folders, moving.id)?.parentId ?? null)}
              onPick={(into) => {
                moveTo(moving, into)
                setMoving(null)
              }}
            />
            <div className="popup__actions">
              <button type="button" className="popup__back" onClick={() => setMoving(null)}>
                cancel
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {deletingFolder && (
        <Dialog label={`Delete folder ${deletingFolder.name}?`} onCancel={() => setDeleting(null)}>
          <div className="dialog__form">
            <h2 className="dialog__title">Delete “{deletingFolder.name}”?</h2>
            <p className="dialog__text">
              {hasInside ? `It has ${countOf(doomedCount, foldersIn(folders, deletingFolder.id).length).replace(' · ', ' and ')} in it.` : "It's empty."}
            </p>
            {hasInside && <p className="dialog__text">Keep what's inside and it moves up to {pathTo(folders, deletingFolder.parentId).at(-1)?.name ?? 'my boards'}.</p>}
            <div className="popup__actions boards-delete">
              <button type="button" className="popup__back" onClick={() => setDeleting(null)} autoFocus>
                cancel
              </button>
              {hasInside ? (
                <button type="button" className="popup__back" onClick={() => void removeFolder(deletingFolder.id, true)}>
                  delete it, keep what’s inside
                </button>
              ) : (
                <button type="button" className="popup__stick popup__danger" onClick={() => void removeFolder(deletingFolder.id, true)}>
                  delete it
                </button>
              )}
              {doomedCount > 0 && (
                <button type="button" className="popup__stick popup__danger" onClick={() => void removeFolder(deletingFolder.id, false)}>
                  delete it and its {doomedCount === 1 ? 'board' : `${doomedCount} boards`}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

const nameOf = (thing: Dragged, boards: BoardSummary[], folders: Folders) =>
  `“${thing.kind === 'board' ? (boards.find((b) => b.id === thing.id)?.name ?? 'this board') : (folderById(folders, thing.id)?.name ?? 'this folder')}”`

// One step of the folder path, which you can also drop a board or folder onto.
function Crumb({ label, current, onOpen, onDrop }: { label: string; current: boolean; onOpen: () => void; onDrop: (thing: Dragged) => void }) {
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      className={`boards-path__crumb${over ? ' boards-path__crumb--over' : ''}`}
      aria-current={current ? 'page' : undefined}
      onClick={onOpen}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAGGED)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const thing = dragData(e)
        if (thing) onDrop(thing)
      }}
    >
      {label}
    </button>
  )
}
