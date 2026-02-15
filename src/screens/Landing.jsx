import { useRef, useState, useEffect } from 'react'
import { gsap } from 'gsap'
import BlackHoleTransition from '../components/BlackHoleTransition'
import ParallaxBackground from '../components/ParallaxBackground'

const TRANSITION_MS = 12000
const KID_SPRITES = [
  '/sprites/boy_sprites/Transparent%20PNG/jump/jump_up.png',
  '/sprites/boy_sprites/Transparent%20PNG/jump/jump_fall.png',
]

export default function Landing({ onPlay, onPlayIntent, attempts, initialUsername = '' }) {
  const containerRef = useRef(null)
  const [username, setUsername] = useState(initialUsername)
  const [error, setError] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [kidFrame, setKidFrame] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setKidFrame((f) => (f + 1) % 2), 200)
    return () => clearInterval(id)
  }, [])

  const handlePlay = () => {
    const cleanName = username.trim()
    if (!cleanName) {
      setError('Te rugam sa introduci un username.')
      return
    }
    setError('')
    if (onPlayIntent) onPlayIntent()
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
        <ParallaxBackground scrollOffset={0} />
        <div className="landing-content">
          <h1 className="landing-title">Bine ai venit!</h1>
          <div className="landing-text">
            <p>
              Daca ai ajuns aici, inseamna ca parintii mei vor sa fii alaturi de mine la botez.
            </p>
            <p>
            Pana acolo, trebuie sa ma ajuti sa recreez drumul meu catre planeta albastra.
            </p>
            <p>
              Odata ajuns acolo voi putea sa-ti dau mai multe detalii.
            </p>
            <p className="landing-incepem">Incepem?</p>
            <p>
              Adauga-ti numele complet si hai sa incepem.
            </p>
          </div>

          <label htmlFor="username" className="landing-label">Nume complet</label>
          <input
            id="username"
            className="landing-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ex: Martin Radulescu"
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

        <div className="landing-kid" aria-hidden>
          <img
            src={KID_SPRITES[kidFrame]}
            alt=""
            className="landing-kid-sprite"
          />
        </div>
      </div>
      <BlackHoleTransition active={isTransitioning} durationMs={TRANSITION_MS} />
    </>
  )
}
