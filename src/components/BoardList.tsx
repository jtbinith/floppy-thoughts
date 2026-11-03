import { useState } from 'react'
import { MAX_BOARD_NAME } from '../lib/board'
import type { BoardSummary } from '../lib/storage'
import { BoardSketch } from './BoardSketch'

// Your boards as cards, newest first: open, rename or delete.

type Props = {
  boards: BoardSummary[]
  openId?: string
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

const edited = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BoardList({ boards, openId, onOpen, onRename, onDelete }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  return (
    <ul className="boards">
      <li>
        <a className="boards__new" href="#/new">
          <span aria-hidden="true">+</span>
          new board
        </a>
      </li>
      {boards.map((b) => (
        <li key={b.id} className={`boards__card${b.id === openId ? ' boards__card--open' : ''}`}>
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
