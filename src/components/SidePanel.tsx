import { useState, type PointerEvent } from 'react'
import { CATEGORY_LABEL } from '../lib/board'
import type { Spark } from '../lib/sparks/deal'
import type { BoardSummary, Favourite } from '../lib/storage'
import { BoardList } from './BoardList'
import { HeartIcon } from './HeartIcon'
import { VendingMachine } from './VendingMachine'

// The drawer beside the board: the vending machine, your favourites, or your boards.
export type PanelTab = 'machine' | 'favourites' | 'boards'

type Props = {
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  onClose: () => void
  onBoard: ReadonlySet<string>
  onVend: (note: Spark) => void
  // A note is out of the machine and showing in the popup.
  busy: boolean
  boardId: string
  favourites: Favourite[]
  onOpenFavourite: (favourite: Favourite) => void
  onUnfavourite: (favourite: Favourite) => void
  // Copy this board's favourites onto a new board.
  onFavouritesBoard: () => void
  boards: BoardSummary[]
  onOpenBoard: (id: string) => void
  onNewBoard: () => void
  onRenameBoard: (id: string, name: string) => void
  onDeleteBoard: (id: string) => void
}

const kindLabel = ({ node }: Favourite) =>
  node.kind === 'spark' ? `~/${node.category ? CATEGORY_LABEL[node.category] : 'note'}` : node.kind === 'nudge' ? `// ${node.nudgeType}` : '~/idea'

// The drawer's width is a personal preference, so it's remembered, like the terminal's height.
const WIDTH_KEY = 'hunchhack:ui:panel-width'
const DEFAULT_WIDTH = 330
const MIN_WIDTH = 240
const maxWidth = () => Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.5))
const clampWidth = (w: number) => Math.round(Math.min(Math.max(w, MIN_WIDTH), maxWidth()))
const savedWidth = () => {
  const saved = Number(localStorage.getItem(WIDTH_KEY))
  return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : DEFAULT_WIDTH
}

export function SidePanel(props: Props) {
  const { tab, onTab, onClose } = props
  const [width, setWidth] = useState(savedWidth)

  function resizeTo(next: number) {
    const w = clampWidth(next)
    setWidth(w)
    localStorage.setItem(WIDTH_KEY, String(w))
  }

  // Drag the left edge to resize, like the side bar in VS Code.
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = width
    handle.setPointerCapture(event.pointerId)
    const onMove = (e: globalThis.PointerEvent) => resizeTo(startWidth + (startX - e.clientX))
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  return (
    <aside className="panel" style={{ width }} aria-label={{ machine: 'Vending machine', favourites: 'Favourites', boards: 'My boards' }[tab]}>
      <div
        className="panel__resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the drawer"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startDrag}
        onDoubleClick={() => resizeTo(DEFAULT_WIDTH)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') resizeTo(width + 20)
          else if (e.key === 'ArrowRight') resizeTo(width - 20)
        }}
      />
      <div className="panel__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'machine'} className="panel__tab" onClick={() => onTab('machine')}>
          machine
        </button>
        <button type="button" role="tab" aria-selected={tab === 'favourites'} className="panel__tab" onClick={() => onTab('favourites')}>
          <HeartIcon /> favourites
        </button>
        <button type="button" role="tab" aria-selected={tab === 'boards'} className="panel__tab" onClick={() => onTab('boards')}>
          boards
        </button>
        <button type="button" className="panel__close" aria-label="Close the drawer" title="Close (Esc)" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="panel__body">
        {tab === 'machine' ? <MachineTab {...props} /> : tab === 'favourites' ? <FavouritesTab {...props} /> : <BoardsTab {...props} />}
      </div>
    </aside>
  )
}

function MachineTab({ onBoard, onVend, busy }: Props) {
  return <VendingMachine onBoard={onBoard} onVend={onVend} busy={busy} />
}

function BoardsTab({ boards, boardId, onOpenBoard, onNewBoard, onRenameBoard, onDeleteBoard }: Props) {
  return (
    <>
      <div className="panel__row">
        <button type="button" className="panel__button" onClick={onNewBoard}>
          + new board
        </button>
        <a className="panel__link" href="#/boards">
          all boards page →
        </a>
      </div>
      <BoardList boards={boards} openId={boardId} onOpen={onOpenBoard} onRename={onRenameBoard} onDelete={onDeleteBoard} />
    </>
  )
}

function FavouritesTab({ boardId, favourites, onOpenFavourite, onUnfavourite, onFavouritesBoard }: Props) {
  if (favourites.length === 0)
    return (
      <p className="panel__empty">
        Nothing here yet. Select anything on a board and press <kbd>F</kbd> (or the heart) to keep it here.
      </p>
    )

  // Group by board, this board first.
  const groups = new Map<string, Favourite[]>()
  for (const f of [...favourites].sort((a, b) => Number(b.boardId === boardId) - Number(a.boardId === boardId))) {
    groups.set(f.boardId, [...(groups.get(f.boardId) ?? []), f])
  }

  const onThisBoard = favourites.some((f) => f.boardId === boardId)
  return (
    <div className="favs">
      {onThisBoard && (
        <button type="button" className="panel__button" onClick={onFavouritesBoard} title="A new board with just this board's favourites, and the links between them">
          put this board&apos;s favourites on a new board
        </button>
      )}
      {[...groups.values()].map((items) => (
        <section key={items[0].boardId} className="favs__board">
          <h3>
            {items[0].boardName}
            {items[0].boardId === boardId && <small> · this board</small>}
          </h3>
          <ul>
            {items.map((f) => (
              <li key={f.node.id} className={`favs__item favs__item--${f.node.kind}`}>
                <button type="button" className="favs__open" onClick={() => onOpenFavourite(f)} title={f.boardId === boardId ? 'Show it on the board' : 'Open that board'}>
                  <small>{kindLabel(f)}</small>
                  {f.node.text}
                </button>
                <button type="button" className="favs__remove" aria-label={`Unfavourite ${f.node.text}`} title="Unfavourite" onClick={() => onUnfavourite(f)}>
                  <HeartIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
