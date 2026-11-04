import { useEffect, useState } from 'react'
import { MAX_BOARD_NAME, type Board } from '../../lib/board'
import { favouriteIdeas } from '../../lib/summary'
import type { Here } from '../../lib/account/live'
import type { SyncState } from '../../lib/account/outbox'
import { MenuBar, type Menu } from '../MenuBar'
import { ThemeToggle } from '../ThemeToggle'

// The strip along the top of the board's screen: the menus, the board's name in the middle like
// a window title (click to rename), and on the right the sun/moon button, a short notice when
// there is one, and "my idea" once you've picked it.
export function ScreenBar({
  menus,
  board,
  renaming,
  onRenaming,
  onRename,
  notice,
  onShowIdea,
  viewOnly,
  here,
  onShare,
  sync,
}: {
  menus: Menu[]
  board: Board
  renaming: boolean
  onRenaming: (renaming: boolean) => void
  onRename: (name: string) => void
  notice: string | null
  onShowIdea: () => void
  // You can see and favourite, but not change, a board shared with you as a viewer.
  viewOnly: boolean
  // Who else has this board open right now.
  here: Here[]
  onShare: () => void
  sync: SyncState
}) {
  const favCount = favouriteIdeas(board).length
  return (
    <header className="screen__bar">
      <MenuBar menus={menus} />
      <div className="screen__name">
        {renaming ? (
          <input
            className="screen__rename"
            aria-label="Board name"
            defaultValue={board.name}
            maxLength={MAX_BOARD_NAME}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') onRenaming(false)
            }}
            onBlur={(e) => {
              onRename(e.currentTarget.value)
              onRenaming(false)
            }}
          />
        ) : (
          <button type="button" className="screen__name-button" title="Rename this board" onClick={() => onRenaming(true)}>
            {board.name}
          </button>
        )}
      </div>
      <div className="screen__end">
        <ThemeToggle className="theme-toggle--bar" />
        {here.length > 0 && (
          <span className="screen__here" aria-label={`Also here: ${here.map((p) => p.name).join(', ')}`}>
            {here.slice(0, 4).map((p) =>
              p.avatarUrl ? <img key={p.id} src={p.avatarUrl} alt="" title={`${p.name} is here`} width={20} height={20} /> : <span key={p.id} title={`${p.name} is here`}>{p.name.slice(0, 2)}</span>,
            )}
            {here.length > 4 && <small>+{here.length - 4}</small>}
          </span>
        )}
        <SaveStatus sync={sync} />
        {viewOnly && (
          <span className="screen__notice screen__view-only" title="The owner gave you view access: you can look and favourite, not change things">
            view only
          </span>
        )}
        {notice && (
          <span className="screen__notice" role="status">
            {notice}
          </span>
        )}
        <button type="button" className="screen__new screen__share" onClick={onShare} title="Invite people to this board">
          share
        </button>
        {favCount > 0 && (
          <button type="button" className="screen__new screen__summary" onClick={onShowIdea} title="Your favourite ideas, and how you got to each">
            ♥ {favCount > 1 ? 'my ideas' : 'my idea'}
          </button>
        )}
      </div>
    </header>
  )
}

const changes = (n: number) => `${n} change${n > 1 ? 's' : ''}`

// Saving, said only when it matters. Online, saves take a moment, so nothing shows. Offline, it
// says your changes are kept here; once you're back it says they're sending, then that they're
// all saved, for a few seconds.
function SaveStatus({ sync }: { sync: SyncState }) {
  // Whether there's a backlog from being offline still going out, and whether it just finished.
  const [catchingUp, setCatchingUp] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [seen, setSeen] = useState(sync)
  if (seen.offline !== sync.offline || seen.waiting !== sync.waiting) {
    setSeen(sync)
    if (sync.offline) setCatchingUp(true)
    else if (catchingUp && sync.waiting === 0) {
      setCatchingUp(false)
      setJustSaved(true)
    }
  }
  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 4000)
    return () => clearTimeout(t)
  }, [justSaved])

  const text = sync.offline
    ? `offline${sync.waiting ? ` · ${changes(sync.waiting)} kept here` : ''}`
    : catchingUp && sync.waiting
      ? `saving ${changes(sync.waiting)}…`
      : justSaved
        ? 'all changes saved'
        : null
  if (!text) return null
  return (
    <span className="screen__notice screen__offline" role="status" title="Changes are kept in this browser until they've reached your account">
      {text}
    </span>
  )
}
