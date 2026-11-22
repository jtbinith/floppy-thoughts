import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
import { DRAGGED, TOP, countOf, dragData, dragEnded, type Dragged } from './folderDrag'
import { FolderTree } from './FolderTree'
import { NavBar } from './NavBar'
import { usePhone } from '../lib/usePhone'
import { CrossIcon, TickIcon } from './TickIcon'
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
  const phone = usePhone()
  const [sort, setSort] = useState<Sort>(savedSort)
  // Your folders: the copy kept in this browser straight away, then the latest once loaded. Until
  // they're known at all (the first visit signed in), the boards wait too, so none of them shows up
  // loose for a moment before jumping into its folder.
  const [raw, setRaw] = useState<Folders>(() => folderStore.kept() ?? NO_FOLDERS)
  const [known, setKnown] = useState(() => folderStore.kept() !== null)
  // The folder you're looking at (null: the top), kept while you pop into a board and back.
  const [at, setAtState] = useState<string | null>(() => sessionStorage.getItem(KEYS.boardsFolder))
  const [moving, setMoving] = useState<Dragged | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  // A short message at the bottom of the screen after a change: what moved where, or that it
  // didn't save. It goes after a few seconds.
  const [notice, setNotice] = useState<{ text: string; ok: boolean; n: number } | null>(null)
  const say = useCallback((text: string, ok = true) => setNotice((was) => ({ text, ok, n: (was?.n ?? 0) + 1 })), [])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), notice.ok ? 3500 : 6000)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    let gone = false
    // (Signing in or out gives the page a new folder store, and App starts it afresh.)
    const kept = folderStore.kept()
    const show = (f: Folders) => {
      if (gone) return
      setRaw(f)
      setKnown(true)
    }
    folderStore.load().then(show, () => show(kept ?? NO_FOLDERS))
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
      try {
        await folderStore.save(before, next)
        return true
      } catch {
        setRaw(before)
        say("That didn't save. Check your connection and try again.", false)
        return false
      }
    },
    [raw, folderStore, say],
  )

  function changeSort(value: string) {
    if (!isSort(value)) return
    setSort(value)
    localStorage.setItem(KEYS.boardSort, value)
  }

  async function moveTo(thing: Dragged, into: string | null) {
    const what = nameOf(thing, boards, folders)
    const where = into ? `“${folderById(folders, into)?.name}”` : 'my boards (no folder)'
    const now = thing.kind === 'board' ? folderOf(folders, thing.id) : (folderById(folders, thing.id)?.parentId ?? null)
    if (now === into) return say(`${what} is already in ${where}.`)
    if (thing.kind === 'folder' && !canMoveFolder(raw, thing.id, into)) return say(`A folder can't go inside itself.`, false)
    const next = thing.kind === 'board' ? placeBoard(raw, thing.id, into) : moveFolder(raw, thing.id, into)
    const before = raw
    setRaw(next ?? raw)
    try {
      if (next) await folderStore.save(before, next)
      say(`Moved ${what} to ${where}.`)
    } catch {
      setRaw(before)
      say(`Couldn't move ${what}. Check your connection and try again.`, false)
    }
  }

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
  // Beside the tree, just what's in the folder you've picked (at the top: boards in no folder).
  // Searching looks through every board, and says which folder each is in.
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

        {known && (
        <div className="boards-layout">
          <TreePanel phone={phone}>
            <FolderTree
              folders={folders}
              boards={boards}
              at={here}
              openId={props.openId}
              onPick={(id) => {
                setSearch('')
                setAt(id)
              }}
              onOpenBoard={props.onOpen}
              onDrop={(thing, into) => void moveTo(thing, into)}
            />
          </TreePanel>
          <div className="boards-layout__main">
            {searching ? (
              <p className="boards-path">searching every folder</p>
            ) : (
    here && (
          <nav className="boards-path" aria-label="Folder">
                <Crumb drop={TOP} label="my boards" current={!here} onOpen={() => setAt(null)} onDrop={(thing) => void moveTo(thing, null)} />
                {path.map((f) => (
                  <span key={f.id} className="boards-path__step">
                    <span aria-hidden="true">/</span>
                    <Crumb drop={f.id} label={f.name} current={f.id === here} onOpen={() => setAt(f.id)} onDrop={(thing) => thing.id !== f.id && void moveTo(thing, f.id)} />
                  </span>
                ))}
              </nav>
            )
            )}

            {!searching && foldersIn(folders, here).length > 0 && <h2 className="boards-heading">folders</h2>}
            {!searching && (
              <FolderCards
                folders={folders}
                at={here}
                boardCount={(id) => boardsInside(folders, id).length}
                onOpen={setAt}
                onRename={(id, name) => void change(renameFolder(raw, id, name))}
                onMove={(id) => setMoving({ kind: 'folder', id })}
                onDelete={setDeleting}
                onDrop={(thing, into) => void moveTo(thing, into)}
              />
            )}
            {!searching && <h2 className="boards-heading">{here ? `boards in ${folderById(folders, here)?.name}` : 'boards not in a folder'}</h2>}
            <BoardList
              {...props}
              boards={shown}
              onMove={(id) => setMoving({ kind: 'board', id })}
              where={searching ? whereIs : undefined}
              onDropInto={(thing, into) => void moveTo(thing, into)}
              onNew={() => (here ? sessionStorage.setItem(KEYS.newBoardFolder, here) : sessionStorage.removeItem(KEYS.newBoardFolder))}
            />
            {searching && shown.length === 0 && <p className="boards-tools__none">No boards match “{search.trim()}”.</p>}
            {!searching && here && shown.length === 0 && foldersIn(folders, here).length === 0 && (
              <p className="boards-tools__none">This folder's empty. Move a board here, or start one.</p>
            )}
          </div>
        </div>
        )}
      </main>
      <SiteFooter />
      {notice && (
        <p key={notice.n} className={`boards-notice${notice.ok ? '' : ' boards-notice--bad'}`} role={notice.ok ? 'status' : 'alert'}>
          {notice.ok ? <TickIcon size={18} /> : <CrossIcon size={15} />}
          <span>{notice.text}</span>
        </p>
      )}

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
              <button type="submit" className="popup__stick popup__tick" aria-label="Make folder" title="Make folder">
                <TickIcon />
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
                void moveTo(moving, into)
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
function Crumb({ drop, label, current, onOpen, onDrop }: { drop: string; label: string; current: boolean; onOpen: () => void; onDrop: (thing: Dragged) => void }) {
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      className={`boards-path__crumb${over ? ' boards-path__crumb--over' : ''}`}
      data-drop={drop}
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
        dragEnded()
        const thing = dragData(e)
        if (thing) onDrop(thing)
      }}
    >
      {label}
    </button>
  )
}

// On a phone the tree folds away above the cards (tap to open it); elsewhere it's always there,
// beside them.
function TreePanel({ phone, children }: { phone: boolean; children: ReactNode }) {
  if (!phone) return <aside className="boards-layout__tree">{children}</aside>
  return (
    <details className="boards-layout__tree boards-layout__tree--folding">
      <summary>folders and boards</summary>
      {children}
    </details>
  )
}
