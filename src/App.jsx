import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import Landing from './screens/Landing'
import Game from './screens/Game'
import EndScreen from './screens/EndScreen'
import './App.css'

const ATTEMPTS_KEY = 'martins_baptism_attempts'
const USERNAME_KEY = 'martins_baptism_username'
const INTRO_SEEN_KEY = 'martins_baptism_intro_seen'

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

export default function App() {
  const [hasSeenIntro, setHasSeenIntro] = useState(readIntroSeen)
  const [screen, setScreen] = useState(() => (readIntroSeen() ? 'game' : 'landing'))
  const [attempts, setAttempts] = useState(readAttempts)
  const [username, setUsername] = useState(readUsername)
  const gameRef = useRef(null)
  const endRef = useRef(null)

  const goToGame = (nextUsername) => {
    const cleanName = nextUsername.trim()
    setUsername(cleanName)
    setAttempts((value) => value + 1)
    setHasSeenIntro(true)
    setScreen('game')
  }
  const goToEnd = () => setScreen('end')
  const countRetry = () => setAttempts((value) => value + 1)
  const goToLanding = () => setScreen('landing')

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
          onPlay={goToGame}
          attempts={attempts}
          initialUsername={username}
        />
      )}
      {screen === 'game' && (
        <div ref={gameRef} className="screen-wrapper">
          <Game
            onReachEnd={goToEnd}
            attempts={attempts}
            username={username}
            onRetry={countRetry}
            onBackToIntro={goToLanding}
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
