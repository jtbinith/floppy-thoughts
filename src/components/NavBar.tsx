import { ThemeToggle } from './ThemeToggle'

// The bar along the top of the home and boards pages: the logo (home), your boards, and the
// dark/light switch.
type Props = {
  current: 'home' | 'boards'
  showBoards: boolean
}

export function NavBar({ current, showBoards }: Props) {
  return (
    <header className="home__nav">
      <a className="home__logo" href="#/" aria-current={current === 'home' ? 'page' : undefined}>
        Floppy Thoughts
      </a>
      <nav className="nav" aria-label="Pages">
        {showBoards && (
          <a className="nav__link" href="#/boards" aria-current={current === 'boards' ? 'page' : undefined}>
            my boards
          </a>
        )}
        <ThemeToggle />
      </nav>
    </header>
  )
}
