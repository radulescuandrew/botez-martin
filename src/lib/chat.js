import { supabase, isSupabaseEnabled } from './supabase'

/**
 * Fetches chat messages. No auth required.
 * @param {number} limit - Max messages to return (default 100)
 * @param {string|null} sinceAt - ISO timestamp; if set, only messages after this time
 * @returns {Promise<Array<{ id: string, author_name: string, body: string, created_at: string }>>}
 */
export async function fetchChatMessages(limit = 100, sinceAt = null) {
  if (!isSupabaseEnabled() || !supabase) return []
  const { data, error } = await supabase.rpc('get_chat_messages', {
    p_limit: limit,
    p_since_at: sinceAt || null,
  })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    author_name: row.author_name ?? '',
    body: row.body ?? '',
    created_at: row.created_at,
  }))
}

/**
 * Sends a chat message. Author name and body are validated server-side.
 * @param {string} authorName - Display name (1-100 chars)
 * @param {string} body - Message text (1-2000 chars)
 * @returns {Promise<string>} - New message id
 */
export async function sendChatMessage(authorName, body) {
  if (!isSupabaseEnabled() || !supabase) {
    throw new Error('Chat is not available')
  }
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_author_name: String(authorName ?? '').trim(),
    p_body: String(body ?? '').trim(),
  })
  if (error) throw error
  return data
}
