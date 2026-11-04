import type { RealtimeChannel } from '@supabase/supabase-js'
import { ME, type BoardNode } from '../board'
import type { BoardChange } from '../changes'
import type { Account } from './account'
import { supabase } from './supabase'

// A shared board, live: everyone with it open is on its private channel ("board:<id>"). Each
// change someone saves is sent to the others, who merge it in box by box, and everyone can see
// who else is here. Only people on the board can use the channel (supabase/migrations).

export type Here = { id: string; name: string; avatarUrl: string | null }

// In the app you're ME; on the wire everyone is their account id.
const swap = (change: BoardChange, from: string, to: string): BoardChange => ({
  ...change,
  nodes: change.nodes.map((n): BoardNode => (n.favouritedBy ? { ...n, favouritedBy: n.favouritedBy.map((w) => (w === from ? to : w)) } : n)),
})

export type Live = { send: (change: BoardChange) => void; leave: () => void }

export function joinLive(
  boardId: string,
  me: Account,
  { onChange, onHere }: { onChange: (change: BoardChange) => void; onHere: (people: Here[]) => void },
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
      .on('broadcast', { event: 'change' }, ({ payload }) => {
        const change = payload as BoardChange
        if (change?.boardId === boardId && Array.isArray(change.nodes)) onChange(swap(change, me.id, ME))
      })
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
    send: (change) => void channel?.send({ type: 'broadcast', event: 'change', payload: swap(change, ME, me.id) }),
    leave: () => {
      left = true
      if (channel) void db.removeChannel(channel)
    },
  }
}
