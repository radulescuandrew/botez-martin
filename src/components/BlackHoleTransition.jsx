import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CRAWL_LINES = [
  'Intr-un univers nu foarte indepartat...',
  'Se apropie ziua in care Martin va fi botezat.',
  'Martin se pregateste serios pentru aceasta zi.',
  'Probabil o sa intre in picioare in cristelnita la cat de mare e...',
  'Dar tu ai un rol important',
  'Il ajuti sa ajunga la biserica completand urmatorul joc.',
  'Abia apoi vei afla detaliile despre ziua cea mare.',
  'P.S: Jucatorul cu cel mai mare scor, va avea o surpriza!',
  'Calatoria lui Martin incepe acum, cu tine alaturi.',
  '3..', 
  '2...',
  '1...',
  "START!"
]

function StarTunnel({ active }) {
  const pointsRef = useRef(null)
  const progressRef = useRef(0)

  const { positions, speeds } = useMemo(() => {
    const count = 520
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = 0.5 + Math.random() * 6.2
      pos[i * 3] = Math.cos(angle) * radius
      pos[i * 3 + 1] = Math.sin(angle) * radius
      pos[i * 3 + 2] = -Math.random() * 72
      vel[i] = 0.28 + Math.random() * 0.9
    }
    return { positions: pos, speeds: vel }
  }, [])

  useFrame((_, delta) => {
    const points = pointsRef.current
    if (!points) return
    progressRef.current = THREE.MathUtils.lerp(progressRef.current, active ? 1 : 0, delta * 4)
    const p = progressRef.current
    if (p < 0.01) return

    const positionAttr = points.geometry.attributes.position
    const arr = positionAttr.array
    const speedBase = 10 + p * 62

    for (let i = 0; i < speeds.length; i += 1) {
      const idx = i * 3 + 2
      arr[idx] += delta * speedBase * speeds[i]
      if (arr[idx] > 3) arr[idx] = -72
    }
    positionAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#e9f2ff" transparent opacity={0.98} />
    </points>
  )
}

function Scene({ active }) {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <StarTunnel active={active} />
    </>
  )
}

// Fixed crawl speed (independent of how long the transition screen stays visible)
const CRAWL_TRAVEL_MS = 12000
const CRAWL_SPAWN_INTERVAL_MS = Math.max(2800, Math.floor(CRAWL_TRAVEL_MS / (CRAWL_LINES.length + 1)))

const CRAWL_AUDIO_SRC = '/starwars.mp3'

export default function BlackHoleTransition({ active, showStory = true, onSkip }) {
  const [activeLines, setActiveLines] = useState([])
  const timersRef = useRef([])
  const audioRef = useRef(null)
  // Parent controls how long the screen stays via its own timeout; crawl speed is fixed below
  const travelDuration = CRAWL_TRAVEL_MS
  const spawnInterval = CRAWL_SPAWN_INTERVAL_MS

  useEffect(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      audioRef.current = new Audio(CRAWL_AUDIO_SRC)
    }
    const audio = audioRef.current
    if (!audio) return
    if (active && showStory) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    } else {
      audio.pause()
      audio.currentTime = 0
    }
    return () => {
      audio.pause()
      audio.currentTime = 0
    }
  }, [active, showStory])

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []

    if (!active || !showStory) {
      setActiveLines([])
      return
    }

    setActiveLines([])
    CRAWL_LINES.forEach((line, index) => {
      const spawnTimer = window.setTimeout(() => {
        const id = `${index}-${Date.now()}`
        setActiveLines((prev) => [...prev, { id, line }])
        const cleanupTimer = window.setTimeout(() => {
          setActiveLines((prev) => prev.filter((entry) => entry.id !== id))
        }, travelDuration + 250)
        timersRef.current.push(cleanupTimer)
      }, index * spawnInterval)
      timersRef.current.push(spawnTimer)
    })

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id))
      timersRef.current = []
    }
  }, [active, showStory, spawnInterval, travelDuration])

  return (
    <div
      className={`blackhole-transition-3d ${active ? 'active' : ''}`}
      style={{ '--travel-duration': `${travelDuration}ms` }}
      aria-hidden="true"
    >
      {active && onSkip && (
        <button
          type="button"
          className="blackhole-skip-btn"
          onClick={onSkip}
          aria-label="Skip"
        >
          Skip
        </button>
      )}
      <Canvas camera={{ position: [0, 0, 7], fov: 58 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <Scene active={active} />
      </Canvas>
      {showStory && (
        <div className="story-sequence">
          {activeLines.map((entry) => (
            <p key={entry.id} className="story-line">
              {entry.line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
