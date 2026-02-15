import { useRef, useState, useEffect } from 'react'
import { gsap } from 'gsap'
import BlackHoleTransition from '../components/BlackHoleTransition'
import TimboBackground from '../components/TimboBackground'

const MIN_TRANSITION_MS = 10000
const TRANSITION_MS = Math.max(MIN_TRANSITION_MS, 33000)
const KID_SPRITES = [
  '/sprites/boy_sprites_2/Jump%20(2).png',
  '/sprites/boy_sprites_2/Jump%20(3).png',
]

export default function Landing({ onPlay, onPlayIntent, attempts, initialUsername = '' }) {
  const containerRef = useRef(null)
  const [username, setUsername] = useState(initialUsername)
  const [error, setError] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [kidFrame, setKidFrame] = useState(0)

  const hasStoredName = Boolean(initialUsername?.trim())

  useEffect(() => {
    setUsername(initialUsername)
  }, [initialUsername])

  useEffect(() => {
    const id = setInterval(() => setKidFrame((f) => (f + 1) % 2), 200)
    return () => clearInterval(id)
  }, [])

  const nameToUseRef = useRef(null)

  const startTransition = (nameToUse) => {
    setError('')
    // Do not call onPlayIntent here: it would start Mario while the transition (starwars) is playing.
    setIsTransitioning(true)
    nameToUseRef.current = nameToUse

    const complete = () => {
      const name = nameToUseRef.current
      if (name == null) return
      nameToUseRef.current = null
      onPlay(name)
    }

    const container = containerRef.current
    if (container) {
      gsap.to(container, {
        opacity: 0,
        scale: 1.08,
        rotationX: 10,
        filter: 'blur(2px)',
        duration: TRANSITION_MS / 1000,
        ease: 'power2.in',
        onComplete: complete,
      })
    }
    setTimeout(complete, TRANSITION_MS + 500)
  }

  const handlePlay = () => {
    if (hasStoredName) {
      startTransition(initialUsername.trim())
      return
    }
    const cleanName = username.trim()
    if (!cleanName) {
      setError('Te rugam sa introduci un username.')
      return
    }
    startTransition(cleanName)
  }

  return (
    <>
      <div ref={containerRef} className="screen landing-screen">
        <TimboBackground scrollOffset={0} />
        <div className="landing-content">
          <div className="landing-party-image-wrap">
            <img
              src="/Martin_Party.png"
              alt=""
              className="landing-party-image"
              style={{ width: '250px', height: '250px' }}
            />
          </div>
          <h1 className="landing-title">
            {hasStoredName ? `Bine ai venit, ${initialUsername.trim()}!` : 'Bine ai venit!'}
          </h1>
          <div className="landing-text">
            <p>
              Daca ai ajuns aici, inseamna ca parintii mei vor sa fii alaturi de mine la botez.
            </p>
            <p>
              Pana acolo, hai sa jucam un joc.
            </p>
            <p>
              Odata ce ai terminat, voi putea sa-ti dau mai multe detalii.
            </p>
            <p className="landing-incepem">Incepem?</p>
            {!hasStoredName && (
              <p>
                Adauga-ti numele complet si hai sa incepem.
              </p>
            )}
          </div>

          {!hasStoredName && (
            <>
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
            </>
          )}

          <button
            type="button"
            className="landing-play-btn"
            onClick={handlePlay}
            disabled={isTransitioning}
          >
            {isTransitioning ? 'Se incarca...' : hasStoredName ? 'Hai sa jucam' : 'Play'}
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
