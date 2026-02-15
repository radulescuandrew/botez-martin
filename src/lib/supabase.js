import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Supabase env missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Progress sync and invite tracking will be disabled.')
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          detectSessionInUrl: true,
        },
      })
    : null

export function isSupabaseEnabled() {
  return Boolean(supabase)
}

let ensureSessionPromise = null

export async function getSupabaseSession() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Supabase getSession:', error.message)
      return null
    }
    return data?.session ?? null
  } catch (err) {
    console.warn('Supabase getSession:', err?.message)
    return null
  }
}

export async function ensureSupabaseSession() {
  if (!supabase) return null
  if (ensureSessionPromise) return ensureSessionPromise
  ensureSessionPromise = (async () => {
    const existing = await getSupabaseSession()
    if (existing?.user?.id) return existing

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn('Supabase anonymous sign-in:', error.message)
      return null
    }
    return data?.session ?? (await getSupabaseSession())
  })()

  try {
    return await ensureSessionPromise
  } finally {
    ensureSessionPromise = null
  }
}
