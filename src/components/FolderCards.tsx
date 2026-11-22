import { useEffect, useRef, useState } from 'react'
import { MAX_FOLDER_NAME, foldersIn, withEverythingInside, type Folder, type Folders } from '../lib/folders'
import { FolderIcon } from './FolderIcon'
import { DRAGGED, countOf, dragData, dragEnded, dragStarted, holdToDrag, type Dragged } from './folderDrag'

// The folders in the folder you're looking at, as cards above its boards: tap to open, and the
// small ⋯ menu to rename, move or delete. Boards and folders can be dragged onto a folder to put them in it (with a mouse; on a
// touch screen, "move" does the same by tapping).

type Props = {
  folders: Folders
  at: string | null
  // How many boards are in a folder, counting folders inside it (only boards still on your list).
  boardCount: (id: string) => number
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onMove: (id: string) => void
  onDelete: (id: string) => void
  onDrop: (thing: Dragged, into: string) => void
}

export function FolderCards({ folders, at, boardCount, onOpen, onRename, onMove, onDelete, onDrop }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  // The folder whose ⋯ menu is open.
  const [menu, setMenu] = useState<string | null>(null)
  const shown = foldersIn(folders, at)
  if (!shown.length) return null

  return (
    <ul className="folders" aria-label="Folders">
      {shown.map((f) => {
        const inner = foldersIn(folders, f.id).length
        const boards = boardCount(f.id)
        return (
          <li
            key={f.id}
            className={`folders__card${over === f.id ? ' folders__card--over' : ''}`}
            data-drop={f.id}
            draggable={renaming !== f.id}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAGGED, JSON.stringify({ kind: 'folder', id: f.id } satisfies Dragged))
              e.dataTransfer.effectAllowed = 'move'
              dragStarted()
            }}
            onDragEnd={dragEnded}
            onTouchStart={(e) => renaming !== f.id && holdToDrag(e, { kind: 'folder', id: f.id }, f.name, (thing, into) => into && onDrop(thing, into))}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAGGED)) return
              e.preventDefault()
              setOver(f.id)
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              dragEnded()
              const thing = dragData(e)
              if (thing && thing.id !== f.id) onDrop(thing, f.id)
            }}
          >
            {renaming === f.id ? (
              <div className="folders__open">
                <FolderIcon />
                <input
                  className="boards__rename"
                  aria-label="Folder name"
                  defaultValue={f.name}
                  maxLength={MAX_FOLDER_NAME}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  onBlur={(e) => {
                    onRename(f.id, e.currentTarget.value)
                    setRenaming(null)
                  }}
                />
              </div>
            ) : (
              <button type="button" className="folders__open" onClick={() => onOpen(f.id)}>
                <FolderIcon />
                <strong>{f.name}</strong>
                <small>{countOf(boards, inner)}</small>
              </button>
            )}
            <FolderMenu name={f.name} open={menu === f.id} onToggle={(open) => setMenu(open ? f.id : null)} onRename={() => setRenaming(f.id)} onMove={() => onMove(f.id)} onDelete={() => onDelete(f.id)} />
          </li>
        )
      })}
    </ul>
  )
}

// Where to move a board or folder to: every folder, as a tree you tap, and the top of the page.
// A folder can't go into itself or anything inside it, so those aren't offered.
export function MoveTargets({ folders, moving, current, onPick }: { folders: Folders; moving: Dragged; current: string | null; onPick: (into: string | null) => void }) {
  const blocked = moving.kind === 'folder' ? withEverythingInside(folders, moving.id) : new Set<string>()
  const rows: { folder: Folder; depth: number }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const f of foldersIn(folders, parent)) {
      if (blocked.has(f.id)) continue
      rows.push({ folder: f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return (
    <ul className="move-to" aria-label="Move to">
      <li>
        <button type="button" className="move-to__button" aria-current={current === null || undefined} disabled={current === null} onClick={() => onPick(null)}>
          my boards <small>(no folder)</small>
        </button>
      </li>
      {rows.map(({ folder, depth }) => (
        <li key={folder.id} style={{ paddingLeft: `${depth * 1.1}rem` }}>
          <button type="button" className="move-to__button" aria-current={current === folder.id || undefined} disabled={current === folder.id} onClick={() => onPick(folder.id)}>
            <FolderIcon size={12} /> {folder.name}
          </button>
        </li>
      ))}
    </ul>
  )
}


// A folder's ⋯ menu: rename, move and delete, kept off the card until you ask. Esc, or a tap
// anywhere else, closes it.
function FolderMenu({ name, open, onToggle, onRename, onMove, onDelete }: { name: string; open: boolean; onToggle: (open: boolean) => void; onRename: () => void; onMove: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const toggle = useRef(onToggle)
  useEffect(() => {
    toggle.current = onToggle
  })
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && toggle.current(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const pick = (action: () => void) => () => {
    onToggle(false)
    action()
  }
  return (
    <span className="folder-menu" ref={ref} onKeyDown={(e) => e.key === 'Escape' && onToggle(false)} onTouchStart={(e) => e.stopPropagation()}>
      <button type="button" className="folder-menu__button" aria-label={`Folder options for ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => onToggle(!open)}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <span className="folder-menu__list" role="menu" aria-label={`${name} options`}>
          <button type="button" role="menuitem" onClick={pick(onRename)}>
            rename
          </button>
          <button type="button" role="menuitem" onClick={pick(onMove)}>
            move
          </button>
          <button type="button" role="menuitem" className="folder-menu__danger" onClick={pick(onDelete)}>
            delete
          </button>
        </span>
      )}
    </span>
  )
}
