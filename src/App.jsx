import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import Landing from './screens/Landing'
import DifficultySelect from './screens/DifficultySelect'
import Game from './screens/Game'
import EndScreen from './screens/EndScreen'
import './App.css'

const ATTEMPTS_KEY = 'martins_baptism_attempts'
const USERNAME_KEY = 'martins_baptism_username'
const INTRO_SEEN_KEY = 'martins_baptism_intro_seen'
const DIFFICULTY_KEY = 'martins_baptism_difficulty'
const BEST_SCORE_PREFIX = 'martins_best_score_'

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

export default function App() {
  const [hasSeenIntro, setHasSeenIntro] = useState(readIntroSeen)
  const [screen, setScreen] = useState(() => (readIntroSeen() ? 'game' : 'landing'))
  const [attempts, setAttempts] = useState(readAttempts)
  const [username, setUsername] = useState(readUsername)
  const [difficulty, setDifficulty] = useState(readDifficulty)
  const gameRef = useRef(null)
  const endRef = useRef(null)
  const bgAudioRef = useRef(null)
  const gameOverAudioRef = useRef(null)
  const preloadedVideosRef = useRef([])

  const ensureBackgroundSongPlaying = () => {
    if (!bgAudioRef.current) {
      const audio = new Audio('/starwars.mp3')
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
    setScreen('game')
  }
  const goToEnd = () => setScreen('end')
  const countRetry = () => setAttempts((value) => value + 1)
  const goToLanding = () => setScreen('landing')
  const goToDifficultyMenu = () => setScreen('difficulty')

  useEffect(() => {
    localStorage.setItem(ATTEMPTS_KEY, String(attempts))
  }, [attempts])

  useEffect(() => {
    localStorage.setItem(USERNAME_KEY, username)
  }, [username])

  useEffect(() => {
    localStorage.setItem(INTRO_SEEN_KEY, hasSeenIntro ? '1' : '0')
  }, [hasSeenIntro])

  useEffect(() => {
    localStorage.setItem(DIFFICULTY_KEY, difficulty)
  }, [difficulty])

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

  return (
    <main className="app">
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
          scoresByDifficulty={readScoresByDifficulty()}
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
          />
        </div>
      )}
      {screen === 'end' && (
        <div ref={endRef} className="screen-wrapper">
          <EndScreen />
        </div>
      )}
    </main>
  )
}
