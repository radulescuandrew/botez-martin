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

export default function App() {
  const isLargeScreen = useLargeScreen()
  const isMobilePortrait = useMobilePortrait()
  const isMobileLandscape = useMobileLandscape()
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
  const [rotateOverlayMenuOpen, setRotateOverlayMenuOpen] = useState(false)

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

  useEffect(() => {
    if (screen !== 'game') setRotateOverlayMenuOpen(false)
  }, [screen])

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
      {isMobilePortrait && screen === 'game' && (
        <div className="rotate-to-landscape-overlay" role="alert" aria-live="polite">
          <button
            type="button"
            className="rotate-overlay-menu-btn"
            aria-label="Open menu"
            onClick={() => setRotateOverlayMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          {rotateOverlayMenuOpen && (
            <div
              className="rotate-overlay-menu-backdrop"
              onClick={() => setRotateOverlayMenuOpen(false)}
              role="presentation"
            >
              <div
                className="rotate-overlay-menu-panel"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Escape') setRotateOverlayMenuOpen(false)
                }}
              >
                <h2>Meniu</h2>
                <button
                  type="button"
                  className="rotate-overlay-menu-action"
                  onClick={() => {
                    setRotateOverlayMenuOpen(false)
                    goToDifficultyMenu()
                  }}
                >
                  Schimba dificultatea
                </button>
                <button
                  type="button"
                  className="rotate-overlay-menu-action"
                  onClick={() => {
                    setRotateOverlayMenuOpen(false)
                    goToLanding()
                  }}
                >
                  Inapoi la meniul principal
                </button>
                <button
                  type="button"
                  className="rotate-overlay-menu-close"
                  onClick={() => setRotateOverlayMenuOpen(false)}
                >
                  Inchide
                </button>
              </div>
            </div>
          )}
          <div className="rotate-to-landscape-content">
            <div className="rotate-to-landscape-icon" aria-hidden>
              <span className="rotate-phone" />
            </div>
            <p className="rotate-to-landscape-title">Landscape</p>
            <p className="rotate-to-landscape-text">
              Roteste telefonul orizontal pentru a juca. E mai usor asa.
            </p>
          </div>
        </div>
      )}
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
        <>
          <div ref={endRef} className="screen-wrapper">
            <EndScreen />
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
        </>
      )}
    </main>
  )
}
