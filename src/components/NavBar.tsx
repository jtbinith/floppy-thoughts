import { useEffect, useRef, useState } from 'react'
import { accountsOn, signIn, signOut, useAccount, type Account } from '../lib/account/account'
import { ShrimpIcon } from './ShrimpIcon'
import { ThemeToggle } from './ThemeToggle'

// The bar along the top of the home, boards and info pages: the logo (home), the page links,
// the dark/light switch, and signing in (or your picture, with a small menu, once you have).
type Props = {
  current: 'home' | 'boards' | 'info'
}

// Boards is always there: with none yet, its page starts with "+ new board".
export function NavBar({ current }: Props) {
  return (
    <header className="home__nav">
      <a className="home__logo" href="#/" aria-current={current === 'home' ? 'page' : undefined}>
        <span className="home__logo-mark" aria-hidden="true">
          <ShrimpIcon size={20} />
        </span>
        <span>
          Floppy <span className="home__logo-accent">Thoughts</span>
        </span>
      </a>
      <nav className="nav" aria-label="Pages">
        <a className="nav__link" href="#/" aria-current={current === 'home' ? 'page' : undefined}>
          Home
        </a>
        <a className="nav__link" href="#/boards" aria-current={current === 'boards' ? 'page' : undefined}>
          Boards
        </a>
      </nav>
      <div className="nav__end">
        {accountsOn && <AccountButton />}
        <ThemeToggle className="nav__theme" />
      </div>
    </header>
  )
}

// Signed out: "sign in" (with GitHub). Signed in: your picture, which opens a small menu.
function AccountButton() {
  const { account, ready } = useAccount()
  if (!ready) return null
  if (!account)
    return (
      <button type="button" className="nav__sign-in" onClick={() => void signIn()} title="Sign in with GitHub to share boards and keep them on every device">
        Sign In
      </button>
    )
  return <AccountMenu account={account} />
}

function AccountMenu({ account }: { account: Account }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // Closes on a click anywhere else, or Esc.
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="nav__account" ref={box}>
      <button
        type="button"
        className="nav__avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${account.name}: your account`}
        onClick={() => setOpen(!open)}
      >
        {account.avatarUrl ? <img src={account.avatarUrl} alt="" width={30} height={30} /> : <span>{account.name.slice(0, 2)}</span>}
      </button>
      {open && (
        <div className="nav__menu" role="menu">
          <p className="nav__menu-name">
            signed in as <strong>{account.name}</strong>
          </p>
          <a role="menuitem" href="#/account" onClick={() => setOpen(false)}>
            Your Account
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
