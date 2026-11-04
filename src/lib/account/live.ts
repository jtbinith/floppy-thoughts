import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Account } from './account'
import { supabase } from './supabase'

// A shared board, live: everyone with it open is on its private channel ("board:<id>"). When
// someone saves a change, the others are told the board changed, and each reads what changed from
// the database itself, so nobody's screen ever shows something the database didn't accept. Everyone
// can also see who else is here. Only people on the board can use the channel (supabase/migrations).

export type Here = { id: string; name: string; avatarUrl: string | null }

export type Live = { changed: () => void; leave: () => void }

export function joinLive(
  boardId: string,
  me: Account,
  { onChanged, onHere }: { onChanged: () => void; onHere: (people: Here[]) => void },
): Live | null {
  if (!supabase) return null
  const db = supabase
  let channel: RealtimeChannel | null = null
  let left = false

  void (async () => {
    // Private channels check who you are against the rules above.
    await db.realtime.setAuth()
    if (left) return
    channel = db
      .channel(`board:${boardId}`, { config: { private: true, broadcast: { self: false }, presence: { key: me.id } } })
      .on('broadcast', { event: 'changed' }, () => onChanged())
      .on('presence', { event: 'sync' }, () => {
        const state = channel?.presenceState<Omit<Here, 'id'>>() ?? {}
        // One entry per person, however many windows they have open.
        onHere(Object.entries(state).map(([id, [first]]) => ({ id, name: first?.name ?? 'someone', avatarUrl: first?.avatarUrl ?? null })))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel?.track({ name: me.name, avatarUrl: me.avatarUrl })
      })
  })()

  return {
    // Just "this board changed": what changed comes from the database.
    changed: () => void channel?.send({ type: 'broadcast', event: 'changed', payload: {} }),
    leave: () => {
      left = true
      if (channel) void db.removeChannel(channel)
    },
  }
}
