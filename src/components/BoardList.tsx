import { useState } from 'react'
import { MAX_BOARD_NAME } from '../lib/board'
import type { BoardSummary } from '../lib/storage'
import { BoardSketch } from './BoardSketch'
import { CardMenu } from './CardMenu'
import { SharedWith } from './SharedWith'
import { DRAGGED, dragEnded, dragStarted, holdToDrag, type Dragged } from './folderDrag'

// Your boards as cards, newest first: tap to open, and the ⋯ menu to rename, move to a folder or
// delete. With a mouse, a
// card can also be dragged onto a folder.

type Props = {
  boards: BoardSummary[]
  openId?: string
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onMove?: (id: string) => void
  // Which folder a board is in, shown on its card (when searching every folder).
  where?: (id: string) => string | undefined
  // The link that starts a new board (it goes in the folder you're looking at).
  onNew?: () => void
  // Putting a board in a folder by dragging (or press and hold on a touch screen).
  onDropInto?: (thing: Dragged, into: string | null) => void
}

const edited = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BoardList({ boards, openId, onOpen, onRename, onDelete, onMove, where, onNew, onDropInto }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  // The board whose ⋯ menu is open.
  const [menu, setMenu] = useState<string | null>(null)

  return (
    <ul className="boards">
      <li>
        <a className="boards__new" href="#/new" onClick={onNew}>
          <span aria-hidden="true">+</span>
          new board
        </a>
      </li>
      {boards.map((b) => (
        <li
          key={b.id}
          className={`boards__card${b.id === openId ? ' boards__card--open' : ''}`}
          draggable={!!onMove && renaming !== b.id}
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAGGED, JSON.stringify({ kind: 'board', id: b.id } satisfies Dragged))
            e.dataTransfer.effectAllowed = 'move'
            dragStarted()
          }}
          onDragEnd={dragEnded}
          onTouchStart={(e) => onDropInto && renaming !== b.id && holdToDrag(e, { kind: 'board', id: b.id }, b.name, onDropInto)}
        >
          {renaming === b.id ? (
            <div className="boards__open">
              <BoardSketch sketch={b.sketch} />
              <input
                className="boards__rename"
                aria-label="Board name"
                defaultValue={b.name}
                maxLength={MAX_BOARD_NAME}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenaming(null)
                }}
                onBlur={(e) => {
                  onRename(b.id, e.currentTarget.value)
                  setRenaming(null)
                }}
              />
            </div>
          ) : (
            <button type="button" className="boards__open" onClick={() => onOpen(b.id)}>
              <BoardSketch sketch={b.sketch} />
              <strong>{b.name}</strong>
              {b.people && <SharedWith people={b.people} />}
              {where?.(b.id) && <small className="boards__where">in {where(b.id)}</small>}
            </button>
          )}

          <div className="boards__foot">
            {deleting === b.id ? (
              <span className="boards__confirm" role="group" aria-label={`Delete ${b.name}?`}>
                delete it?
                <button type="button" className="boards__yes" onClick={() => onDelete(b.id)}>
                  yes
                </button>
                <button type="button" onClick={() => setDeleting(null)} autoFocus>
                  no
                </button>
              </span>
            ) : (
              <>
                <small>edited {edited(b.updatedAt)}</small>
                <CardMenu
                  label={`Board options for ${b.name}`}
                  name={b.name}
                  open={menu === b.id}
                  onToggle={(open) => setMenu(open ? b.id : null)}
                  onRename={() => setRenaming(b.id)}
                  onMove={onMove ? () => onMove(b.id) : undefined}
                  onDelete={() => setDeleting(b.id)}
                />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
