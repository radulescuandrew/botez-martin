import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import Landing from './screens/Landing'
import Game from './screens/Game'
import EndScreen from './screens/EndScreen'
import './App.css'

export default function App() {
  const [screen, setScreen] = useState('landing')
  const gameRef = useRef(null)
  const endRef = useRef(null)

  const goToGame = () => setScreen('game')
  const goToEnd = () => setScreen('end')

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
      {screen === 'landing' && <Landing onPlay={goToGame} />}
      {screen === 'game' && (
        <div ref={gameRef} className="screen-wrapper">
          <Game onReachEnd={goToEnd} />
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
