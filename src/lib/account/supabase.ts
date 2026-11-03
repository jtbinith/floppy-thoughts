import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The connection to Supabase, for accounts and shared boards. Both values are public by design:
// what anyone can do is decided by the database's own rules (supabase/migrations), not by keeping
// these secret. Without them (a fresh clone, or the tests) the app works as before, browser only.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
