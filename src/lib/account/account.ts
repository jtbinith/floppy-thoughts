import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { KEYS } from '../keys'
import { supabase } from './supabase'

// Who's signed in, if anyone. Signing in is optional: everything works without it.

export type Account = { id: string; name: string; avatarUrl: string | null }

const RETURN_KEY = KEYS.returnTo

const toAccount = (user: User): Account => ({
  id: user.id,
  name: String(user.user_metadata.user_name ?? user.user_metadata.name ?? 'you'),
  avatarUrl: (user.user_metadata.avatar_url as string | undefined) ?? null,
})

export const accountsOn = supabase !== null

export async function signIn() {
  if (!supabase) return
  sessionStorage.setItem(RETURN_KEY, location.hash)
  await supabase.auth.signInWithOAuth({
    provider: 'github',
    // Back to this site (the board's own address, without the page), allowed in Supabase's settings.
    options: { redirectTo: `${location.origin}${import.meta.env.BASE_URL}` },
  })
}

export async function signOut() {
  await supabase?.auth.signOut()
}

export function useAccount(): { account: Account | null; ready: boolean } {
  const [account, setAccount] = useState<Account | null>(null)
  const [ready, setReady] = useState(!supabase)
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setAccount(session ? toAccount(session.user) : null)
      setReady(true)
      if (event === 'SIGNED_IN') backToWhereYouWere()
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return { account, ready }
}

// After GitHub, Supabase sends you to the site with ?code=…; supabase-js swaps it for a session.
// Then the code comes out of the address bar and you're back on the page you started from.
function backToWhereYouWere() {
  const back = sessionStorage.getItem(RETURN_KEY)
  if (back === null && !location.search) return
  sessionStorage.removeItem(RETURN_KEY)
  history.replaceState(null, '', `${location.pathname}${back ?? location.hash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
