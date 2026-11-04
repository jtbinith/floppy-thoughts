import { useState } from 'react'
import { signIn, signOut, useAccount, type Account } from '../lib/account/account'
import { supabase } from '../lib/account/supabase'
import type { StorageAdapter } from '../lib/storage'
import { KEYS } from '../lib/keys'
import { SiteFooter } from './InfoPages'
import { NavBar } from './NavBar'

// Your account: who you're signed in as, a copy of everything and deleting it all.
export function AccountPage({ storage }: { storage: StorageAdapter }) {
  const { account, ready } = useAccount()
  return (
    <div className="home">
      <NavBar current="info" />
      <main className="info">
        <h1>your account</h1>
        {!ready ? null : account ? (
          <Signed account={account} storage={storage} />
        ) : (
          <>
            <p>You&apos;re not signed in. Your boards are kept in this browser only.</p>
            <p>
              <button type="button" className="home__cta" onClick={() => void signIn()}>
                sign in with GitHub
              </button>
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function Signed({ account, storage }: { account: Account; storage: StorageAdapter }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')

  // Everything of yours, as one file: your account details and every board you're on.
  async function download() {
    setBusy('putting it together…')
    setProblem(null)
    try {
      const list = await storage.listBoards()
      const boards = []
      for (const b of list) {
        const result = await storage.loadBoard(b.id)
        if (result.status === 'ok') boards.push(result.board)
      }
      const user = (await supabase?.auth.getUser())?.data.user
      const data = {
        about: 'Everything Floppy Thoughts keeps about you. On boards, "me" in favouritedBy is you.',
        downloaded: new Date().toISOString(),
        account: { id: account.id, github: account.name, email: user?.email ?? null, picture: account.avatarUrl, since: user?.created_at ?? null },
        boards,
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `floppy-thoughts-${account.name}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function deleteAccount() {
    if (!supabase) return
    setBusy('deleting…')
    setProblem(null)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setProblem(error.message)
      setBusy(null)
      return
    }
    // Nothing of the account is left in this browser either.
    localStorage.removeItem(KEYS.outbox(account.id))
    await signOut()
    location.hash = '/'
  }

  return (
    <>
      <section className="info__card">
        {account.avatarUrl && <img src={account.avatarUrl} alt="" width={48} height={48} />}
        <div>
          <strong>{account.name}</strong>
          <p>Signed in with GitHub. Your name and picture come from there: change them on GitHub and they update next time you sign in.</p>
        </div>
      </section>

      <h2>download your data</h2>
      <p>One file with your account details and every board you&apos;re on, with everything on them.</p>
      <p>
        <button type="button" className="home__cta home__cta--quiet home__cta--small" onClick={() => void download()} disabled={busy !== null}>
          download my data
        </button>
      </p>

      <h2>sign out</h2>
      <p>
        <button type="button" className="home__cta home__cta--quiet home__cta--small" onClick={() => void signOut()} disabled={busy !== null}>
          sign out
        </button>
      </p>

      <h2>delete your account</h2>
      <p>
        This deletes your account, your name and picture, your favourites and every board you own, for everyone on them. Boxes you added to other
        people&apos;s boards stay so their work isn&apos;t lost. Your name comes off them. It can&apos;t be undone: download your data first if you want
        a copy.
      </p>
      {deleting ? (
        <div className="info__danger">
          <label>
            Type <strong>{account.name}</strong> to confirm
            <input value={typed} onChange={(e) => setTyped(e.currentTarget.value)} autoFocus />
          </label>
          <div className="popup__actions">
            <button type="button" className="home__cta home__cta--quiet home__cta--small" onClick={() => setDeleting(false)}>
              keep my account
            </button>
            <button
              type="button"
              className="home__cta home__cta--danger home__cta--small"
              disabled={typed !== account.name || busy !== null}
              onClick={() => void deleteAccount()}
            >
              delete my account
            </button>
          </div>
        </div>
      ) : (
        <p>
          <button type="button" className="home__cta home__cta--danger home__cta--small" onClick={() => setDeleting(true)} disabled={busy !== null}>
            delete my account…
          </button>
        </p>
      )}

      {busy && <p role="status">{busy}</p>}
      {problem && (
        <p className="info__problem" role="alert">
          {problem}
        </p>
      )}
    </>
  )
}
