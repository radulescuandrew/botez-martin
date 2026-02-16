import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import Landing from './screens/Landing'
import DifficultySelect from './screens/DifficultySelect'
import Game from './screens/Game'
import EndScreen from './screens/EndScreen'
import ChatModal from './components/ChatModal'
import ChatButton from './components/ChatButton'
import { supabase, isSupabaseEnabled } from './lib/supabase'
import { fetchChatMessages, sendChatMessage } from './lib/chat'
import './App.css'

const ATTEMPTS_KEY = 'martins_baptism_attempts'
const CHAT_LAST_READ_KEY = 'martins_baptism_chat_last_read_at'
const LAST_SCORE_KEY = 'martins_last_score'
const HIGH_SCORE_KEY = 'martins_high_score'
const USERNAME_KEY = 'martins_baptism_username'
const INTRO_SEEN_KEY = 'martins_baptism_intro_seen'
const DIFFICULTY_KEY = 'martins_baptism_difficulty'
const BEST_SCORE_PREFIX = 'martins_best_score_'
const INVITE_STORAGE_KEY = 'martins_baptism_invite'
const GAME_COMPLETED_KEY = 'martins_baptism_game_completed'
const PENDING_PROGRESS_KEY = 'martins_baptism_pending_progress'

/** Returns { inviteId, inviteeName, inviteToken } from localStorage. inviteToken = stable identity across browsers. */
function getStoredInvite() {
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

function setStoredInvite(inviteId, inviteeName, inviteToken = null) {
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
    /* localStorage not available (e.g. private) */
  }
}

function readAttempts() {
  const raw = localStorage.getItem(ATTEMPTS_KEY)
  const parsed = Number.parseInt(raw ?? '0', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function readUsername() {
  return (localStorage.getItem(USERNAME_KEY) || '').trim()
}

function readIntroSeen() {
  return localStorage.getItem(INTRO_SEEN_KEY) === '1'
}

function readDifficulty() {
  const value = localStorage.getItem(DIFFICULTY_KEY)
  return value === 'easy' || value === 'medium' || value === 'nightmare' ? value : 'medium'
}

function readGameCompleted() {
  return localStorage.getItem(GAME_COMPLETED_KEY) === '1'
}

function readChatLastReadAt() {
  try {
    const raw = localStorage.getItem(CHAT_LAST_READ_KEY)
    return raw && /^\d{4}-\d{2}-\d{2}T/.test(raw) ? raw : null
  } catch {
    return null
  }
}

function setChatLastReadAt(isoString) {
  try {
    if (isoString) localStorage.setItem(CHAT_LAST_READ_KEY, isoString)
    else localStorage.removeItem(CHAT_LAST_READ_KEY)
  } catch {
    /* ignore */
  }
}

/** Pending progress: { synced: boolean, payload: { attempts, username, introSeen, difficulty, lastScore, highScore, bestScoreEasy, bestScoreMedium, bestScoreNightmare } } */
function getPendingProgress() {
  try {
    const raw = localStorage.getItem(PENDING_PROGRESS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data.synced !== 'boolean' || !data.payload || typeof data.payload !== 'object') return null
    const p = data.payload
    if (!Number.isFinite(p.highScore) || p.highScore < 0) return null
    return data
  } catch {
    return null
  }
}

function setPendingProgress(entry) {
  try {
    if (entry == null) {
      localStorage.removeItem(PENDING_PROGRESS_KEY)
      return
    }
    localStorage.setItem(PENDING_PROGRESS_KEY, JSON.stringify(entry))
  } catch {
    /* ignore */
  }
}

/** On load: if there is unsynced pending progress, try to upload it. Uses same retry pattern as syncProgressToSupabase. */
async function trySyncPendingProgressOnLoad(supabaseClient) {
  if (!supabaseClient) return
  const invite = getStoredInvite()
  if (!invite?.inviteToken) return
  const pending = getPendingProgress()
  if (!pending || pending.synced) return
  const pl = pending.payload
  const rpcPayload = {
    p_attempts: Number.isFinite(pl.attempts) ? pl.attempts : 0,
    p_username: (pl.username != null && String(pl.username).trim()) ? String(pl.username).trim() : '',
    p_intro_seen: typeof pl.introSeen === 'boolean' ? pl.introSeen : false,
    p_difficulty: pl.difficulty === 'easy' || pl.difficulty === 'medium' || pl.difficulty === 'nightmare' ? pl.difficulty : 'medium',
    p_last_score: Number.isFinite(pl.lastScore) && pl.lastScore >= 0 ? pl.lastScore : 0,
    p_high_score: Number.isFinite(pl.highScore) && pl.highScore >= 0 ? pl.highScore : 0,
    p_best_score_easy: Number.isFinite(pl.bestScoreEasy) && pl.bestScoreEasy > 0 ? pl.bestScoreEasy : null,
    p_best_score_medium: Number.isFinite(pl.bestScoreMedium) && pl.bestScoreMedium > 0 ? pl.bestScoreMedium : null,
    p_best_score_nightmare: Number.isFinite(pl.bestScoreNightmare) && pl.bestScoreNightmare > 0 ? pl.bestScoreNightmare : null,
  }
  const delays = [0, 500, 1000, 2000]
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt]))
    const { error } = await supabaseClient.rpc('submit_progress_by_invite_token', {
      p_token: invite.inviteToken,
      ...rpcPayload,
    })
    if (!error) {
      setPendingProgress({ synced: true, payload: pl })
      return
    }
  }
}

function readScoresByDifficulty() {
  const diffs = ['easy', 'medium', 'nightmare']
  const out = {}
  diffs.forEach((d) => {
    const raw = localStorage.getItem(BEST_SCORE_PREFIX + d)
    const n = Number.parseInt(raw ?? '0', 10)
    out[d] = Number.isFinite(n) && n > 0 ? n : null
  })
  return out
}

const DEFAULT_SCORES = {
  lastScore: 0,
  highScore: 0,
  bestScoreEasy: null,
  bestScoreMedium: null,
  bestScoreNightmare: null,
}

const LARGE_SCREEN_BREAKPOINT = 520

function useLargeScreen() {
  const [isLarge, setIsLarge] = useState(() => {
    if (typeof window === 'undefined') return false
    const wide = window.innerWidth > LARGE_SCREEN_BREAKPOINT
    const pointerFine = window.matchMedia('(pointer: fine)').matches
    return wide && pointerFine
  })

  useEffect(() => {
    const update = () => {
      const wide = window.innerWidth > LARGE_SCREEN_BREAKPOINT
      const pointerFine = window.matchMedia('(pointer: fine)').matches
      setIsLarge(wide && pointerFine)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return isLarge
}

function useMobilePortrait() {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false
    const touch = window.matchMedia('(pointer: coarse)').matches
    const portrait = window.innerWidth < window.innerHeight
    return touch && portrait
  })

  useEffect(() => {
    const update = () => {
      const touch = window.matchMedia('(pointer: coarse)').matches
      const portrait = window.innerWidth < window.innerHeight
      setIsPortrait(touch && portrait)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return isPortrait
}

function useMobileLandscape() {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined') return false
    const touch = window.matchMedia('(pointer: coarse)').matches
    const landscape = window.innerWidth > window.innerHeight
    return touch && landscape
  })

  useEffect(() => {
    const update = () => {
      const touch = window.matchMedia('(pointer: coarse)').matches
      const landscape = window.innerWidth > window.innerHeight
      setIsLandscape(touch && landscape)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return isLandscape
}

const useSupabaseProgress = isSupabaseEnabled()

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const isLargeScreen = useLargeScreen()
  const isMobilePortrait = useMobilePortrait()
  const isMobileLandscape = useMobileLandscape()

  const [progressLoaded, setProgressLoaded] = useState(() => !useSupabaseProgress)
  const [authFailed, setAuthFailed] = useState(false)
  const [hasSeenIntro, setHasSeenIntro] = useState(() => readIntroSeen())
  const [screen, setScreen] = useState(() => {
    if (readGameCompleted()) return 'end'
    return readIntroSeen() ? 'difficulty' : 'landing'
  })
  const [gameCompleted, setGameCompleted] = useState(() => readGameCompleted())
  const [attempts, setAttempts] = useState(() => (useSupabaseProgress ? 0 : readAttempts()))
  const [username, setUsername] = useState(() => readUsername())
  const [difficulty, setDifficulty] = useState(() => readDifficulty())
  const [lastScore, setLastScore] = useState(() => (useSupabaseProgress ? 0 : Number.parseInt(localStorage.getItem(LAST_SCORE_KEY) || '0', 10) || 0))
  const [highScore, setHighScore] = useState(() => (useSupabaseProgress ? 0 : Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) || 0))
  const [bestScoreEasy, setBestScoreEasy] = useState(() => {
    if (!useSupabaseProgress) {
      const raw = localStorage.getItem(BEST_SCORE_PREFIX + 'easy')
      const n = Number.parseInt(raw ?? '0', 10)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return null
  })
  const [bestScoreMedium, setBestScoreMedium] = useState(() => {
    if (!useSupabaseProgress) {
      const raw = localStorage.getItem(BEST_SCORE_PREFIX + 'medium')
      const n = Number.parseInt(raw ?? '0', 10)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return null
  })
  const [bestScoreNightmare, setBestScoreNightmare] = useState(() => {
    if (!useSupabaseProgress) {
      const raw = localStorage.getItem(BEST_SCORE_PREFIX + 'nightmare')
      const n = Number.parseInt(raw ?? '0', 10)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return null
  })

  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatLastReadAt, setChatLastReadAtState] = useState(readChatLastReadAt)

  const chatPollTimerRef = useRef(null)
  const chatClosedPollTimerRef = useRef(null)

  const chatUnreadCount = chatMessages.filter(
    (m) => !chatLastReadAt || (m.created_at && new Date(m.created_at) > new Date(chatLastReadAt))
  ).length

  const gameRef = useRef(null)
  const endRef = useRef(null)
  const bgAudioRef = useRef(null)
  const gameOverAudioRef = useRef(null)
  const preloadedVideosRef = useRef([])
  const progressRef = useRef({ attempts: 0, username: '', hasSeenIntro: false, difficulty: 'medium' })
  const lastScorePayloadRef = useRef(null)
  const lastSyncPromiseRef = useRef(null)
  const syncGenerationRef = useRef(0)

  const [scoreSyncStatus, setScoreSyncStatus] = useState('idle') // 'idle' | 'pending' | 'success' | 'failed'
  const [scoreSyncError, setScoreSyncError] = useState('')

  useEffect(() => {
    progressRef.current = { attempts, username, hasSeenIntro, difficulty }
  }, [attempts, username, hasSeenIntro, difficulty])

  useEffect(() => {
    const state = location.state
    if (state?.fromInvite && state?.inviteeName) {
      const name = String(state.inviteeName).trim()
      if (name) {
        setUsername(name)
        setStoredInvite(state.inviteId ?? '', name, state.inviteToken ?? null)
      }
      navigate('/', { replace: true, state: {} })
    } else {
      const stored = getStoredInvite()
      if (stored?.inviteeName) {
        setUsername(stored.inviteeName)
      }
    }
  }, [location.state, navigate])

  const hydrateProgressFromInviteToken = useCallback(async (token) => {
    if (!supabase || !token) return
    setProgressLoaded(true)
    const { data: rows, error } = await supabase.rpc('get_progress_by_invite_token', { p_token: token })
    if (error || !rows?.length) return
    const row = rows[0]
    const rowUsername = row.username != null ? String(row.username).trim() : ''
    const rowIntroSeen = typeof row.intro_seen === 'boolean' ? row.intro_seen : false
    setAttempts((prev) => (Number.isFinite(row.attempts) && row.attempts >= 0 ? row.attempts : prev))
    setUsername((prev) => (rowUsername !== '' ? rowUsername : prev))
    setHasSeenIntro((prev) => (rowIntroSeen || prev))
    setDifficulty((prev) => (row.difficulty === 'easy' || row.difficulty === 'medium' || row.difficulty === 'nightmare' ? row.difficulty : prev))
    if (Number.isFinite(row.last_score) && row.last_score >= 0) setLastScore(row.last_score)
    if (Number.isFinite(row.high_score) && row.high_score >= 0) setHighScore(row.high_score)
    if (Number.isFinite(row.best_score_easy) && row.best_score_easy > 0) setBestScoreEasy(row.best_score_easy)
    if (Number.isFinite(row.best_score_medium) && row.best_score_medium > 0) setBestScoreMedium(row.best_score_medium)
    if (Number.isFinite(row.best_score_nightmare) && row.best_score_nightmare > 0) setBestScoreNightmare(row.best_score_nightmare)
    if (row.completed_game) {
      setGameCompleted(true)
      setScreen('end')
    } else if (rowIntroSeen && rowUsername) {
      setScreen((current) => (current === 'landing' ? 'difficulty' : current))
    }
  }, [])

  const markGameCompletedToSupabase = useCallback(async () => {
    if (!useSupabaseProgress || !supabase) return
    const invite = getStoredInvite()
    if (!invite?.inviteToken) return
    const { error } = await supabase.rpc('mark_game_completed_by_invite_token', { p_token: invite.inviteToken })
    if (error) console.warn('Supabase mark_game_completed_by_invite_token:', error.message)
  }, [useSupabaseProgress])

  useEffect(() => {
    if (!useSupabaseProgress || !supabase) return
    let cancelled = false
    const invite = getStoredInvite()

    const boot = async () => {
      if (invite?.inviteToken) {
        setAuthFailed(false)
        await hydrateProgressFromInviteToken(invite.inviteToken)
        await trySyncPendingProgressOnLoad(supabase)
        return
      }
      setProgressLoaded(true)
      setAuthFailed(true)
    }

    boot()
    return () => { cancelled = true }
  }, [useSupabaseProgress, hydrateProgressFromInviteToken])

  // Progress is sent on every game end (win or failure). Invite-only: no auth path.
  // Retries up to 3 times with backoff. Uses generation to ignore stale completions (no browser refresh cancel).
  const syncProgressToSupabase = useCallback(
    async (payload = null) => {
      if (!useSupabaseProgress || !supabase) return { success: true, gen: 0 }
      const invite = getStoredInvite()
      if (!invite?.inviteToken) return { success: true, gen: 0 }
      const gen = syncGenerationRef.current + 1
      syncGenerationRef.current = gen
      const p = progressRef.current
      const rpcPayload = {
        p_attempts: payload?.attempts ?? p.attempts,
        p_username: ((payload?.username ?? p.username ?? '').trim()) || (p.username ?? ''),
        p_intro_seen: typeof payload?.introSeen === 'boolean' ? payload.introSeen : p.hasSeenIntro,
        p_difficulty: payload?.difficulty ?? p.difficulty,
        p_last_score: payload?.lastScore ?? lastScore,
        p_high_score: payload?.highScore ?? highScore,
        p_best_score_easy: payload?.bestScoreEasy ?? bestScoreEasy ?? null,
        p_best_score_medium: payload?.bestScoreMedium ?? bestScoreMedium ?? null,
        p_best_score_nightmare: payload?.bestScoreNightmare ?? bestScoreNightmare ?? null,
      }
      const delays = [0, 500, 1000, 2000]
      let lastErr = null
      for (let attempt = 0; attempt <= 3; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, delays[attempt]))
          if (syncGenerationRef.current !== gen) return { success: false, error: 'cancelled', gen }
        }
        const { error } = await supabase.rpc('submit_progress_by_invite_token', {
          p_token: invite.inviteToken,
          ...rpcPayload,
        })
        if (!error) {
          return { success: true, gen }
        }
        lastErr = error
      }
      if (lastErr) console.warn('Supabase submit_progress_by_invite_token (after retries):', lastErr.message)
      return { success: false, error: lastErr?.message ?? 'Unknown error', gen }
    },
    [useSupabaseProgress, lastScore, highScore, bestScoreEasy, bestScoreMedium, bestScoreNightmare],
  )

  const handleScoresChange = useCallback(
    (payload = {}) => {
      if (Number.isFinite(payload.lastScore)) setLastScore(payload.lastScore)
      if (Number.isFinite(payload.highScore)) setHighScore(payload.highScore)
      if (payload.bestScoreEasy !== undefined) setBestScoreEasy(payload.bestScoreEasy)
      if (payload.bestScoreMedium !== undefined) setBestScoreMedium(payload.bestScoreMedium)
      if (payload.bestScoreNightmare !== undefined) setBestScoreNightmare(payload.bestScoreNightmare)
      if (!useSupabaseProgress || !supabase) return
      lastScorePayloadRef.current = payload
      const payloadToStore = {
        ...payload,
        introSeen: typeof payload.introSeen === 'boolean' ? payload.introSeen : progressRef.current?.hasSeenIntro,
      }
      setPendingProgress({ synced: false, payload: payloadToStore })
      setScoreSyncStatus('pending')
      setScoreSyncError('')
      const promise = syncProgressToSupabase(payload)
        .then((result) => {
          if (result.gen != null && result.gen !== syncGenerationRef.current) return
          if (result.success) {
            setPendingProgress({ synced: true, payload: payloadToStore })
            setScoreSyncStatus('success')
            setScoreSyncError('')
          } else {
            setScoreSyncStatus('failed')
            setScoreSyncError(result.error ?? 'Nu s-a putut salva scorul.')
          }
        })
        .catch((err) => {
          setScoreSyncStatus('failed')
          setScoreSyncError(err?.message ?? 'Nu s-a putut salva scorul.')
        })
      lastSyncPromiseRef.current = promise
    },
    [syncProgressToSupabase, useSupabaseProgress],
  )

  const retryScoreSave = useCallback(() => {
    const payload = lastScorePayloadRef.current
    if (payload == null) return
    const payloadToStore = {
      ...payload,
      introSeen: typeof payload.introSeen === 'boolean' ? payload.introSeen : progressRef.current?.hasSeenIntro,
    }
    setPendingProgress({ synced: false, payload: payloadToStore })
    setScoreSyncStatus('pending')
    setScoreSyncError('')
    const promise = syncProgressToSupabase(payload)
      .then((result) => {
        if (result.success) {
          setPendingProgress({ synced: true, payload: payloadToStore })
          setScoreSyncStatus('success')
          setScoreSyncError('')
        } else {
          setScoreSyncStatus('failed')
          setScoreSyncError(result.error ?? 'Nu s-a putut salva scorul.')
        }
      })
      .catch((err) => {
        setScoreSyncStatus('failed')
        setScoreSyncError(err?.message ?? 'Nu s-a putut salva scorul.')
      })
    lastSyncPromiseRef.current = promise
  }, [syncProgressToSupabase])

  const ensureBackgroundSongPlaying = () => {
    if (!bgAudioRef.current) {
      const audio = new Audio('/super_mario_track.mp3')
      audio.preload = 'auto'
      bgAudioRef.current = audio
    }
    if (gameOverAudioRef.current) {
      gameOverAudioRef.current.pause()
      gameOverAudioRef.current.currentTime = 0
    }
    if (bgAudioRef.current.paused || bgAudioRef.current.ended) {
      const playPromise = bgAudioRef.current.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {})
      }
    }
  }

  const playGameOverSong = () => {
    if (!gameOverAudioRef.current) {
      const audio = new Audio('/game_over.mp3')
      audio.preload = 'auto'
      gameOverAudioRef.current = audio
    }
    gameOverAudioRef.current.pause()
    gameOverAudioRef.current.currentTime = 0
    const playPromise = gameOverAudioRef.current.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {})
    }
  }

  const stopBackgroundSong = () => {
    if (bgAudioRef.current) {
      bgAudioRef.current.pause()
    }
    if (gameOverAudioRef.current) {
      gameOverAudioRef.current.pause()
      gameOverAudioRef.current.currentTime = 0
    }
  }

  const goToDifficulty = (nextUsername) => {
    const cleanName = nextUsername.trim()
    setUsername(cleanName)
    setHasSeenIntro(true)
    setScreen('difficulty')
  }
  const startGameWithDifficulty = (selectedDifficulty) => {
    setDifficulty(selectedDifficulty)
    setAttempts((value) => value + 1)
    setScoreSyncStatus('idle')
    setScreen('game')
  }
  const goToEnd = useCallback(async () => {
    if (useSupabaseProgress && lastSyncPromiseRef.current) {
      try {
        await lastSyncPromiseRef.current
      } catch (_) {
        // already surfaced via scoreSyncStatus
      }
    }
    setGameCompleted(true)
    setScreen('end')
    if (useSupabaseProgress) {
      markGameCompletedToSupabase().catch((err) => console.warn('Supabase mark_game_completed:', err?.message))
    }
  }, [])
  const countRetry = useCallback(() => {
    if (scoreSyncStatus === 'pending') return
    setScoreSyncStatus('idle')
    setAttempts((value) => value + 1)
  }, [scoreSyncStatus])
  const goToLanding = () => setScreen('landing')
  const goToDifficultyMenu = () => setScreen('difficulty')
  const goToDetails = () => {
    setScreen('end')
  }
  const playAgainFromEnd = useCallback(() => {
    if (scoreSyncStatus === 'pending') return
    setScoreSyncStatus('idle')
    setScreen('difficulty')
  }, [scoreSyncStatus])

  const loadChatMessages = useCallback(async () => {
    if (!isSupabaseEnabled()) return
    setChatLoading(true)
    setChatError('')
    try {
      const rows = await fetchChatMessages(100, null)
      setChatMessages(rows)
    } catch (err) {
      setChatError(err?.message ?? 'Nu am putut incarca mesajele.')
      setChatMessages([])
    } finally {
      setChatLoading(false)
    }
  }, [])

  const handleSendChatMessage = useCallback(
    async (body) => {
      const name = (username || '').trim() || 'Invitat'
      if (!body?.trim() || chatSending) return
      setChatSending(true)
      setChatError('')
      try {
        await sendChatMessage(name, body.trim())
        await loadChatMessages()
      } catch (err) {
        setChatError(err?.message ?? 'Nu am putut trimite mesajul.')
      } finally {
        setChatSending(false)
      }
    },
    [username, chatSending, loadChatMessages]
  )

  const handleChatClose = useCallback(() => {
    setChatOpen(false)
    const newest = chatMessages.reduce((best, m) => {
      if (!m.created_at) return best
      const t = new Date(m.created_at).getTime()
      return t > (best ? new Date(best).getTime() : 0) ? m.created_at : best
    }, null)
    if (newest) {
      setChatLastReadAtState(newest)
      setChatLastReadAt(newest)
    }
  }, [chatMessages])

  useEffect(() => {
    if (chatOpen) {
      loadChatMessages()
      chatPollTimerRef.current = window.setInterval(() => loadChatMessages(), 4000)
      return () => {
        if (chatPollTimerRef.current) {
          window.clearInterval(chatPollTimerRef.current)
          chatPollTimerRef.current = null
        }
      }
    }
  }, [chatOpen, loadChatMessages])

  useEffect(() => {
    if (isSupabaseEnabled()) loadChatMessages()
  }, [loadChatMessages])

  useEffect(() => {
    if (!chatOpen && screen !== 'game' && isSupabaseEnabled()) {
      chatClosedPollTimerRef.current = window.setInterval(() => loadChatMessages(), 20000)
      return () => {
        if (chatClosedPollTimerRef.current) {
          window.clearInterval(chatClosedPollTimerRef.current)
          chatClosedPollTimerRef.current = null
        }
      }
    }
  }, [chatOpen, screen, loadChatMessages])

  useEffect(() => {
    return () => {
      if (chatPollTimerRef.current) window.clearInterval(chatPollTimerRef.current)
      if (chatClosedPollTimerRef.current) window.clearInterval(chatClosedPollTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!useSupabaseProgress) localStorage.setItem(ATTEMPTS_KEY, String(attempts))
  }, [attempts, useSupabaseProgress])

  useEffect(() => {
    if (username.trim()) localStorage.setItem(USERNAME_KEY, username)
  }, [username])

  useEffect(() => {
    localStorage.setItem(INTRO_SEEN_KEY, hasSeenIntro ? '1' : '0')
  }, [hasSeenIntro])

  useEffect(() => {
    localStorage.setItem(DIFFICULTY_KEY, difficulty)
  }, [difficulty])

  useEffect(() => {
    localStorage.setItem(GAME_COMPLETED_KEY, gameCompleted ? '1' : '0')
  }, [gameCompleted])

  // Best-effort: if app opens directly in game (e.g. after refresh), try to start music.
  useEffect(() => {
    if (screen === 'game') {
      ensureBackgroundSongPlaying()
    }
  }, [screen])

  // Browser autoplay-safe fallback: after refresh, start on first user gesture in game.
  useEffect(() => {
    if (screen !== 'game') return
    const startOnGesture = () => {
      ensureBackgroundSongPlaying()
      window.removeEventListener('pointerdown', startOnGesture)
      window.removeEventListener('keydown', startOnGesture)
      window.removeEventListener('touchstart', startOnGesture)
    }
    window.addEventListener('pointerdown', startOnGesture)
    window.addEventListener('keydown', startOnGesture)
    window.addEventListener('touchstart', startOnGesture)
    return () => {
      window.removeEventListener('pointerdown', startOnGesture)
      window.removeEventListener('keydown', startOnGesture)
      window.removeEventListener('touchstart', startOnGesture)
    }
  }, [screen])

  useEffect(() => () => {
    if (bgAudioRef.current) {
      bgAudioRef.current.pause()
      bgAudioRef.current = null
    }
    if (gameOverAudioRef.current) {
      gameOverAudioRef.current.pause()
      gameOverAudioRef.current = null
    }
  }, [])

  // Preload videos early so transition playback starts faster on mobile Safari.
  useEffect(() => {
    const videoUrls = ['/placenta.mp4', '/martin.mp4']
    const nodes = videoUrls.map((url) => {
      const v = document.createElement('video')
      v.preload = 'auto'
      v.src = url
      v.muted = true
      v.playsInline = true
      v.load()
      return v
    })
    preloadedVideosRef.current = nodes
    return () => {
      preloadedVideosRef.current.forEach((v) => {
        v.pause()
        v.removeAttribute('src')
        v.load()
      })
      preloadedVideosRef.current = []
    }
  }, [])

  useEffect(() => {
    if (screen === 'game' && gameRef.current) {
      gsap.fromTo(gameRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 })
    }
  }, [screen])

  useEffect(() => {
    if (screen === 'end' && endRef.current) {
      gsap.fromTo(endRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 })
    }
  }, [screen])

  if (useSupabaseProgress && authFailed) {
    return (
      <main className="app">
        <div className="app-loading app-unknown-user" role="alert">
          <p className="app-auth-error-title">Nu stim cine esti</p>
          <p className="app-auth-error-text">Acceseaza linkul primit pentru a intra.</p>
        </div>
      </main>
    )
  }

  if (useSupabaseProgress && !progressLoaded) {
    return (
      <main className="app">
        <div className="app-loading" role="status" aria-live="polite">
          <p>Se incarca...</p>
        </div>
      </main>
    )
  }

  if (!username.trim() && !gameCompleted) {
    return (
      <main className="app">
        <div className="app-loading app-unknown-user" role="alert">
          <p className="app-auth-error-title">Nu stim cine esti</p>
          <p className="app-auth-error-text">Acceseaza linkul primit pentru a intra.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="app">
      {isLargeScreen && (
        <div className="use-mobile-overlay" role="alert" aria-live="polite">
          <div className="use-mobile-content">
            <div className="use-mobile-icon" aria-hidden>
              <span className="use-mobile-phone" />
            </div>
            <p className="use-mobile-title">Doar pe mobil</p>
            <p className="use-mobile-text">
              Deschide acest link pe telefon pentru a juca.
            </p>
          </div>
        </div>
      )}
      {!isLargeScreen && (
        <>
      {screen === 'landing' && (
        <Landing
          onPlay={goToDifficulty}
          onPlayIntent={ensureBackgroundSongPlaying}
          attempts={attempts}
          initialUsername={username}
        />
      )}
      {screen === 'difficulty' && (
        <DifficultySelect
          initialDifficulty={difficulty}
          onSelect={startGameWithDifficulty}
          onSkipToDetails={goToDetails}
          onBackToMenu={goToLanding}
          scoresByDifficulty={
            useSupabaseProgress
              ? { easy: bestScoreEasy, medium: bestScoreMedium, nightmare: bestScoreNightmare }
              : readScoresByDifficulty()
          }
        />
      )}
      {screen === 'game' && (
        <div ref={gameRef} className="screen-wrapper">
          <Game
            onReachEnd={goToEnd}
            attempts={attempts}
            username={username}
            difficulty={difficulty}
            onRetry={countRetry}
            onBackToIntro={goToLanding}
            onChangeDifficulty={goToDifficultyMenu}
            onRunStartAudio={ensureBackgroundSongPlaying}
            onRunFailAudio={playGameOverSong}
            onEarthHit={stopBackgroundSong}
            onScoresChange={handleScoresChange}
            scoresFromSupabase={
              useSupabaseProgress
                ? {
                    lastScore,
                    highScore,
                    bestScoreEasy,
                    bestScoreMedium,
                    bestScoreNightmare,
                  }
                : undefined
            }
            scoreSyncPending={useSupabaseProgress && scoreSyncStatus === 'pending'}
            scoreSyncFailed={useSupabaseProgress && scoreSyncStatus === 'failed'}
            scoreSyncComplete={useSupabaseProgress && scoreSyncStatus === 'success'}
            scoreSyncError={scoreSyncError}
            onRetryScoreSave={retryScoreSave}
          />
        </div>
      )}
      {screen === 'end' && (
        <>
          <div ref={endRef} className="screen-wrapper">
            <EndScreen
              onPlayAgain={playAgainFromEnd}
              onBackToMenu={goToLanding}
              scoreSyncPending={useSupabaseProgress && scoreSyncStatus === 'pending'}
              scoreSyncFailed={useSupabaseProgress && scoreSyncStatus === 'failed'}
              scoreSyncError={scoreSyncError}
              onRetryScoreSave={retryScoreSave}
            />
          </div>
          {isMobileLandscape && (
            <div className="rotate-to-portrait-overlay" role="alert" aria-live="polite">
              <div className="rotate-to-landscape-content">
                <div className="rotate-to-portrait-icon" aria-hidden>
                  <span className="rotate-phone-portrait" />
                </div>
                <p className="rotate-to-landscape-title">Portrait</p>
                <p className="rotate-to-landscape-text">
                  Roteste telefonul in portrait pentru a vedea pagina de final si RSVP.
                </p>
              </div>
            </div>
          )}
        </>
      )}
          <ChatButton onClick={() => setChatOpen(true)} unreadCount={chatOpen ? 0 : chatUnreadCount} />
          <ChatModal
            open={chatOpen}
            onClose={handleChatClose}
            currentUsername={username}
            messages={chatMessages}
            loading={chatLoading && chatMessages.length === 0}
            error={chatError}
            onSendMessage={handleSendChatMessage}
            onMarkAsRead={handleChatClose}
            sending={chatSending}
          />
        </>
      )}
    </main>
  )
}
