import { useEffect, useState } from 'react'
import { signIn } from '../lib/account/account'
import { joinBoard } from '../lib/account/sharing'
import { NavBar } from './NavBar'

// Where an invite link lands. Signed out, it asks you to sign in (and comes back here after);
// signed in, it joins the board and opens it.
export function JoinPage({ secret, signedIn, ready, onJoined }: { secret: string; signedIn: boolean; ready: boolean; onJoined: (id: string) => Promise<void> }) {
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !signedIn) return
    let gone = false
    joinBoard(secret).then(
      (id) => {
        if (gone) return
        if (id) void onJoined(id)
        else setProblem("This invite link doesn't work any more. Ask whoever sent it for a new one.")
      },
      (e: unknown) => !gone && setProblem(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      gone = true
    }
    // Only when the link or who's signed in changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [secret, signedIn, ready])

  return (
    <div className="page">
      <NavBar current="info" />
      <div className="device">
        <div className="device__screen join">
          {!ready ? null : problem ? (
            <>
              <p className="screen__message" role="alert">
                {problem}
              </p>
              <a className="join__home" href="#/">
                go to Floppy Thoughts
              </a>
            </>
          ) : signedIn ? (
            <p className="screen__message">joining the board…</p>
          ) : (
            <>
              <h1 className="join__title">You&apos;ve been invited to a board</h1>
              <p className="screen__message">Sign in with GitHub to join it and brainstorm together.</p>
              <button type="button" className="popup__stick join__sign-in" onClick={() => void signIn()}>
                sign in with GitHub
              </button>
              <p className="screen__message agree">
                Signing in means you agree to the <a href="#/terms">terms</a>; how your data is handled is on the <a href="#/privacy">privacy</a> page.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
