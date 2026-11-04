import { useEffect, useState } from 'react'
import { signIn, useAccount } from '../lib/account/account'
import { canManage, inviteLink, makeInvite, members, removeMember, setRole, stopInvite, type Member, type Role } from '../lib/account/sharing'
import type { Board } from '../lib/board'
import { Dialog } from './Dialog'

// Board → Share…: the board's invite link, and who's on it. Signed out, it asks you to sign in
// first (that's when your boards move to your account).
export function ShareDialog({ board, onClose }: { board: Board; onClose: () => void }) {
  const { account, ready } = useAccount()
  if (!ready) return null
  return (
    <Dialog label="Share this board" onCancel={onClose} wide>
      <h2 className="dialog__title">share &quot;{board.name}&quot;</h2>
      {account ? (
        <People board={board} me={account.id} onClose={onClose} />
      ) : (
        <>
          <p className="dialog__text">
            Sign in with GitHub to share this board. Your boards move into your account, so you can work on them together, from any device.
          </p>
          <div className="popup__actions">
            <button type="button" className="popup__stick" onClick={() => void signIn()} autoFocus>
              sign in with GitHub
            </button>
            <button type="button" className="popup__back" onClick={onClose}>
              not now
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}

const ROLE_LABEL: Record<Role, string> = { owner: 'owner', admin: 'admin', editor: 'can edit', viewer: 'can view' }

function People({ board, me, onClose }: { board: Board; me: string; onClose: () => void }) {
  const [people, setPeople] = useState<Member[] | null>(null)
  // undefined while loading, null when there's no live link.
  const [link, setLink] = useState<string | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const manager = canManage(people?.find((p) => p.userId === me)?.role)

  async function load() {
    const list = await members(board.id)
    setPeople(list)
    if (canManage(list.find((p) => p.userId === me)?.role)) setLink(await inviteLink(board.id))
  }
  // Problems (no connection, say) show in the dialog instead of breaking it.
  const tryTo = (action: () => Promise<void>) => () => void action().catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))

  useEffect(() => {
    tryTo(load)()
    // Once, when the dialog opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = (url: string) => void navigator.clipboard.writeText(url).then(() => setCopied(true))

  return (
    <>
      {manager && link !== undefined && (
        <section className="share__link">
          <p className="dialog__text">Anyone signed in who opens the link joins as an editor. You can change what each person can do below.</p>
          {link ? (
            <>
              <div className="share__row">
                <input className="share__url" readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="popup__stick" onClick={() => copy(link)} autoFocus>
                  {copied ? 'copied ✓' : 'copy link'}
                </button>
              </div>
              <div className="popup__actions">
                <button
                  type="button"
                  className="popup__back"
                  title="A new link; the old one stops working"
                  onClick={tryTo(async () => {
                    const url = await makeInvite(board.id)
                    setLink(url)
                    setCopied(false)
                  })}
                >
                  reset link
                </button>
                <button
                  type="button"
                  className="popup__back"
                  title="Turn the link off; people already on the board stay"
                  onClick={tryTo(async () => {
                    await stopInvite(board.id)
                    setLink(null)
                  })}
                >
                  stop sharing
                </button>
              </div>
            </>
          ) : (
            <div className="popup__actions">
              <button
                type="button"
                className="popup__stick"
                autoFocus
                onClick={tryTo(async () => {
                  const url = await makeInvite(board.id)
                  setLink(url)
                  copy(url)
                })}
              >
                make an invite link
              </button>
            </div>
          )}
        </section>
      )}

      <section className="share__people">
        <h3>on this board</h3>
        {people === null ? (
          <p className="dialog__text">…</p>
        ) : (
          <ul>
            {people.map((p) => (
              <li key={p.userId}>
                {p.avatarUrl ? <img src={p.avatarUrl} alt="" width={24} height={24} /> : <span className="share__blank" />}
                <span className="share__name">
                  {p.name}
                  {p.userId === me && ' (you)'}
                </span>
                {manager && p.role !== 'owner' ? (
                  <>
                    <select
                      aria-label={`What ${p.name} can do`}
                      value={p.role}
                      onChange={(e) => {
                        const role = e.currentTarget.value as Exclude<Role, 'owner'>
                        tryTo(async () => {
                          await setRole(board.id, p.userId, role)
                          await load()
                        })()
                      }}
                    >
                      <option value="admin">admin</option>
                      <option value="editor">can edit</option>
                      <option value="viewer">can view</option>
                    </select>
                    {p.userId !== me && (
                      <button
                        type="button"
                        className="share__remove"
                        aria-label={`Remove ${p.name}`}
                        title="Remove from this board (the boxes they added stay)"
                        onClick={tryTo(async () => {
                          await removeMember(board.id, p.userId)
                          await load()
                        })}
                      >
                        remove
                      </button>
                    )}
                  </>
                ) : (
                  <small className="share__role">{ROLE_LABEL[p.role]}</small>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="dialog__text share__roles">
          Admins share the board and manage people, like the owner. Editors change things; viewers look and favourite. Only the owner can delete the board.
        </p>
      </section>
      {problem && (
        <p className="dialog__text share__problem" role="alert">
          {problem}
        </p>
      )}
      <div className="popup__actions">
        <button type="button" className="popup__back" onClick={onClose} autoFocus={!manager}>
          done
        </button>
      </div>
    </>
  )
}
