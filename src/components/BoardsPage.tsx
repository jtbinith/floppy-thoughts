import type { BoardSummary } from '../lib/storage'
import { BoardList } from './BoardList'

// All your boards on their own page, outside the device (like the home page).
type Props = {
  boards: BoardSummary[]
  openId?: string
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function BoardsPage(props: Props) {
  return (
    <div className="home">
      <header className="home__nav">
        <a className="home__logo" href="#/">
          Floppy Thoughts
        </a>
        {props.openId && (
          <a className="home__link" href="#/board">
            back to my board →
          </a>
        )}
      </header>
      <main className="boards-page">
        <h1>my boards</h1>
        <p className="home__lede">Everything is saved in this browser.</p>
        <a className="home__cta" href="#/new">
          + new board
        </a>
        <BoardList {...props} />
      </main>
    </div>
  )
}
