import { useState } from 'react'
import { MAX_BOARD_NAME } from '../lib/board'
import type { BoardSummary } from '../lib/storage'
import { BoardSketch } from './BoardSketch'
import { DRAGGED, type Dragged } from './folderDrag'

// Your boards as cards, newest first: open, rename, move to a folder or delete. With a mouse, a
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
}

const edited = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BoardList({ boards, openId, onOpen, onRename, onDelete, onMove, where, onNew }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

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
          }}
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
                <span className="boards__actions">
                  <button type="button" aria-label={`Rename ${b.name}`} onClick={() => setRenaming(b.id)}>
                    rename
                  </button>
                  {onMove && (
                    <button type="button" aria-label={`Move ${b.name}`} onClick={() => onMove(b.id)}>
                      move
                    </button>
                  )}
                  <button type="button" aria-label={`Delete ${b.name}`} onClick={() => setDeleting(b.id)}>
                    delete
                  </button>
                </span>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
