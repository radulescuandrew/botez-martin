import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import BlackHoleTransition from '../components/BlackHoleTransition'

const TRANSITION_MS = 12000

export default function Landing({ onPlay, attempts, initialUsername = '' }) {
  const containerRef = useRef(null)
  const [username, setUsername] = useState(initialUsername)
  const [error, setError] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handlePlay = () => {
    const cleanName = username.trim()
    if (!cleanName) {
      setError('Te rugam sa introduci un username.')
      return
    }
    setError('')
    setIsTransitioning(true)

    const container = containerRef.current
    if (container) {
      gsap.to(container, {
        opacity: 0,
        scale: 1.08,
        rotationX: 10,
        filter: 'blur(2px)',
        duration: TRANSITION_MS / 1000,
        ease: 'power2.in',
        onComplete: () => onPlay(cleanName),
      })
    } else {
      setTimeout(() => onPlay(cleanName), TRANSITION_MS)
    }
  }

  return (
    <>
      <div ref={containerRef} className="screen landing-screen">
        <h1 className="landing-title">Bine ai venit!</h1>
        <p className="landing-subtitle">
          Urmeaza sa intri intr-un mini-joc in care trebuie sa treci de obstacole
          pentru a te inregistra si a afla detalii despre Botezul Martinilor.
        </p>
        <p className="landing-date">Incercari totale salvate: {attempts}</p>

        <label htmlFor="username" className="landing-label">Username</label>
        <input
          id="username"
          className="landing-input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ex: Andrei"
          disabled={isTransitioning}
          maxLength={24}
        />
        {error && <p className="landing-error">{error}</p>}

        <button
          type="button"
          className="landing-play-btn"
          onClick={handlePlay}
          disabled={isTransitioning}
        >
          {isTransitioning ? 'Se incarca...' : 'Play'}
        </button>
      </div>
      <BlackHoleTransition active={isTransitioning} durationMs={TRANSITION_MS} />
    </>
  )
}
