import { supabase } from './supabase'

// Sharing a board in your account: invite links, who's on it, and their roles. What anyone can
// do is checked by the database (supabase/migrations); these just ask.

export type Role = 'owner' | 'admin' | 'editor' | 'viewer'
// Owners and admins share the board and manage who's on it.
export const canManage = (role: Role | null | undefined) => role === 'owner' || role === 'admin'
export type Member = { userId: string; name: string; avatarUrl: string | null; role: Role }

function db() {
  if (!supabase) throw new Error('Sharing needs an account')
  return supabase
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// The address an invite link opens: this site, then the link's secret.
export const inviteUrl = (secret: string) => `${location.origin}${import.meta.env.BASE_URL}#/join/${secret}`

export const makeInvite = async (boardId: string) => inviteUrl(unwrap(await db().rpc('make_invite', { board: boardId })) as string)
export const stopInvite = async (boardId: string) => void unwrap(await db().rpc('stop_invite', { board: boardId }))
// The board's live link, or null if there isn't one (owners and admins).
export async function inviteLink(boardId: string): Promise<string | null> {
  const secret = unwrap(await db().rpc('invite_link', { board: boardId })) as string | null
  return secret ? inviteUrl(secret) : null
}
// The board's id, or null if the link is wrong or was turned off.
export const joinBoard = async (secret: string) => unwrap(await db().rpc('join_board', { secret })) as string | null

export async function myRole(boardId: string, me: string): Promise<Role | null> {
  const rows = unwrap(await db().from('board_members').select('role').eq('board_id', boardId).eq('user_id', me)) as { role: Role }[]
  return rows[0]?.role ?? null
}

const ORDER: Record<Role, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 }

export async function members(boardId: string): Promise<Member[]> {
  const rows = unwrap(await db().from('board_members').select('user_id, role, joined_at').eq('board_id', boardId).order('joined_at')) as {
    user_id: string
    role: Role
  }[]
  const ids = rows.map((r) => r.user_id)
  const profiles = unwrap(await db().from('profiles').select('id, name, avatar_url').in('id', ids)) as { id: string; name: string; avatar_url: string | null }[]
  const byId = new Map(profiles.map((p) => [p.id, p]))
  return rows
    .map((r) => ({ userId: r.user_id, role: r.role, name: byId.get(r.user_id)?.name || 'someone', avatarUrl: byId.get(r.user_id)?.avatar_url ?? null }))
    .sort((a, b) => ORDER[a.role] - ORDER[b.role])
}

export const setRole = async (boardId: string, userId: string, role: Exclude<Role, 'owner'>) =>
  void unwrap(await db().from('board_members').update({ role }).eq('board_id', boardId).eq('user_id', userId))

// Removing someone (owners and admins) or leaving (anyone but the owner). Their boxes stay on the board.
export const removeMember = async (boardId: string, userId: string) =>
  void unwrap(await db().from('board_members').delete().eq('board_id', boardId).eq('user_id', userId))
