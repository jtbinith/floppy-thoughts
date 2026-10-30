import { useState } from 'react'
import { MAX_BOARD_NAME } from '../lib/board'
import type { BoardSummary } from '../lib/storage'
import { HeartIcon } from './HeartIcon'

// Your boards, newest first: open, rename or delete. Used in the drawer and on the boards page.

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

  if (boards.length === 0) return <p className="boards__empty">No boards yet.</p>

  return (
    <ul className="boards">
      {boards.map((b) => (
        <li key={b.id} className={`boards__item${b.id === openId ? ' boards__item--open' : ''}`}>
          {renaming === b.id ? (
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
          ) : (
            <button type="button" className="boards__open" onClick={() => onOpen(b.id)}>
              <strong>{b.name}</strong>
              <small>
                {b.nodeCount} {b.nodeCount === 1 ? 'thing' : 'things'}
                {b.favouriteCount > 0 && (
                  <>
                    {' · '}
                    <HeartIcon size={9} /> {b.favouriteCount}
                  </>
                )}
                {' · '}edited {edited(b.updatedAt)}
                {b.id === openId && ' · open now'}
              </small>
            </button>
          )}

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
            <span className="boards__actions">
              <button type="button" aria-label={`Rename ${b.name}`} onClick={() => setRenaming(b.id)}>
                rename
              </button>
              <button type="button" aria-label={`Delete ${b.name}`} onClick={() => setDeleting(b.id)}>
                delete
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
