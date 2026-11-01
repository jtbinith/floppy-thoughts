import { useState, type PointerEvent } from 'react'
import { CATEGORY_LABEL } from '../lib/board'
import type { Spark } from '../lib/sparks/deal'
import type { Favourite } from '../lib/storage'
import { CommandsTab } from './CommandsTab'
import { HeartIcon } from './HeartIcon'
import { VendingMachine } from './VendingMachine'
import { KEYS } from '../lib/keys'

// The drawer beside the board: the vending machine, your favourites, or the commands.
export type PanelTab = 'machine' | 'favourites' | 'commands'

type Props = {
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  onClose: () => void
  onBoard: ReadonlySet<string>
  onVend: (note: Spark) => void
  // A note is out of the machine and showing in the popup.
  busy: boolean
  boardId: string
  // This board's favourites.
  favourites: Favourite[]
  onOpenFavourite: (favourite: Favourite) => void
  onUnfavourite: (favourite: Favourite) => void
  // Copy this board's favourites onto a new board.
  onFavouritesBoard: () => void
  // Put a command in the terminal (from the commands tab).
  onUseCommand: (command: string) => void
}

const kindLabel = ({ node }: Favourite) =>
  node.kind === 'spark' ? `~/${node.category ? CATEGORY_LABEL[node.category] : 'note'}` : node.kind === 'nudge' ? `// ${node.nudgeType}` : '~/idea'

// The drawer's width is a personal preference, so it's remembered, like the terminal's height.
const WIDTH_KEY = KEYS.panelWidth
const DEFAULT_WIDTH = 360
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
    <aside className="panel" style={{ width }} aria-label={{ machine: 'Vending machine', favourites: 'Favourites', commands: 'Commands' }[tab]}>
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
        <button type="button" role="tab" aria-selected={tab === 'commands'} className="panel__tab" onClick={() => onTab('commands')}>
          commands
        </button>
        <button type="button" className="panel__close" aria-label="Close the drawer" title="Close (Esc)" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="panel__body">
        {tab === 'machine' ? (
          <MachineTab {...props} />
        ) : tab === 'favourites' ? (
          <FavouritesTab {...props} />
        ) : (
          <CommandsTab onUse={props.onUseCommand} />
        )}
      </div>
    </aside>
  )
}

function MachineTab({ onBoard, onVend, busy }: Props) {
  return <VendingMachine onBoard={onBoard} onVend={onVend} busy={busy} />
}

function FavouritesTab({ favourites, onOpenFavourite, onUnfavourite, onFavouritesBoard }: Props) {
  if (favourites.length === 0)
    return (
      <p className="panel__empty">
        No favourites on this board yet. Select anything and press <kbd>F</kbd> (or the heart) to keep it here.
      </p>
    )

  return (
    <div className="favs">
      <button type="button" className="panel__button" onClick={onFavouritesBoard} title="A new board with just these favourites, and the links between them">
        put these on a new board
      </button>
      <ul className="favs__list">
        {favourites.map((f) => (
          <li key={f.node.id} className={`favs__item favs__item--${f.node.kind}`}>
            <button type="button" className="favs__open" onClick={() => onOpenFavourite(f)} title="Show it on the board">
              <small>{kindLabel(f)}</small>
              {f.node.text}
            </button>
            <button type="button" className="favs__remove" aria-label={`Unfavourite ${f.node.text}`} title="Unfavourite" onClick={() => onUnfavourite(f)}>
              <HeartIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
