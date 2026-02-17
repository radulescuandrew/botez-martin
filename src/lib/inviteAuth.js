import { supabase, isSupabaseEnabled } from './supabase'

const INVITE_STORAGE_KEY = 'martins_baptism_invite'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function getStoredInvite() {
  try {
    const raw = localStorage.getItem(INVITE_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data.inviteeName !== 'string') return null
    return {
      inviteId: data.inviteId ?? '',
      inviteeName: data.inviteeName ?? '',
      inviteToken: typeof data.inviteToken === 'string' && data.inviteToken.length > 0 ? data.inviteToken : null,
    }
  } catch {
    return null
  }
}

export function setStoredInvite(inviteId, inviteeName, inviteToken = null) {
  try {
    localStorage.setItem(
      INVITE_STORAGE_KEY,
      JSON.stringify({
        inviteId: inviteId ?? '',
        inviteeName: inviteeName ?? '',
        inviteToken: inviteToken ?? null,
      })
    )
  } catch {
    /* localStorage not available */
  }
}

export function extractInviteIdFromInput(rawInput) {
  const value = String(rawInput ?? '').trim()
  if (!value) return ''
  if (!/[/.]/.test(value) && !/^https?:\/\//i.test(value)) return value

  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`
    const url = new URL(normalized)
    const parts = url.pathname.split('/').filter(Boolean)
    if (!parts.length) return value
    return parts[parts.length - 1].trim()
  } catch {
    return value
  }
}

export function isValidInviteUuid(value) {
  const candidate = String(value ?? '').trim()
  return UUID_REGEX.test(candidate)
}

export async function issueInviteSession(inviteId) {
  const inviteUuid = String(inviteId ?? '').trim()
  if (!inviteUuid || !isValidInviteUuid(inviteUuid)) {
    throw new Error('INVALID_INVITE')
  }
  if (!isSupabaseEnabled() || !supabase) {
    throw new Error('SUPABASE_DISABLED')
  }

  const { data: issueData, error: issueErr } = await supabase.rpc('issue_invite_token', {
    p_invite_id: inviteUuid,
  })

  if (issueErr || !issueData) {
    throw new Error(issueErr?.message || 'INVALID_INVITE')
  }

  const token = String(issueData.token ?? '').trim()
  const name = String(issueData.name ?? '').trim()

  if (!token) {
    throw new Error('INVALID_INVITE')
  }

  await supabase.rpc('record_invite_join', { p_invite_id: inviteUuid })

  return {
    inviteId: inviteUuid,
    inviteeName: name,
    inviteToken: token,
  }
}
