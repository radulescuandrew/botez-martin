import { supabase, isSupabaseEnabled } from './supabase'

function pickBestDifficulty(row) {
  const entries = [
    { difficulty: 'easy', score: row.best_score_easy ?? 0 },
    { difficulty: 'medium', score: row.best_score_medium ?? 0 },
    { difficulty: 'nightmare', score: row.best_score_nightmare ?? 0 },
  ]
  const top = entries.reduce((best, current) => {
    if (current.score > best.score) return current
    return best
  }, { difficulty: row.difficulty ?? 'medium', score: row.high_score ?? 0 })

  if (top.score > 0) return top.difficulty
  return row.difficulty ?? 'medium'
}

/** Fetches leaderboard (invitee progress only). No session required. */
export async function fetchLeaderboard(limit = 50) {
  if (!isSupabaseEnabled() || !supabase) return []
  const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: limit })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    best_difficulty: pickBestDifficulty(row),
    total_attempts: Number.isFinite(row.attempts) ? row.attempts : 0,
  }))
}
