import { accountsOn, signIn, signOut, useAccount } from '../lib/account/account'
import { ThemeToggle } from './ThemeToggle'

// The bar along the top of the home and boards pages: the logo (home), your boards, signing in,
// and the dark/light switch.
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
        {accountsOn && <AccountButton />}
        <ThemeToggle />
      </nav>
    </header>
  )
}

// Signed out: "sign in" (with GitHub). Signed in: your picture and name, and "sign out".
function AccountButton() {
  const { account, ready } = useAccount()
  if (!ready) return null
  if (!account)
    return (
      <button type="button" className="nav__link nav__button" onClick={() => void signIn()} title="Sign in with GitHub to share boards and keep them on every device">
        sign in
      </button>
    )
  return (
    <span className="nav__account">
      {account.avatarUrl && <img className="nav__avatar" src={account.avatarUrl} alt="" width={22} height={22} />}
      <span className="nav__name">{account.name}</span>
      <button type="button" className="nav__link nav__button" onClick={() => void signOut()}>
        sign out
      </button>
    </span>
  )
}
