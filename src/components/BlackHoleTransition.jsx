import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CRAWL_LINES = [
  'Martin este pe cale sa se nasca.',
  'Pana sa ajunga acasa, calatoreste prin univers printre planete.',
  'Drumul lui are un singur final: Pamantul.',
  'Evita obstacolele, ramai pe traiectorie si cauta planeta albastra.',
  'Misiunea se incheie doar cand atingi Pamantul.',
  'Calatoria lui Martin incepe acum...',
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

export default function BlackHoleTransition({ active, durationMs = 5200, showStory = true }) {
  const [activeLines, setActiveLines] = useState([])
  const timersRef = useRef([])
  const travelDuration = Math.max(16000, Math.floor(durationMs * 1.4))
  const spawnInterval = Math.max(1700, Math.floor(travelDuration / (CRAWL_LINES.length + 1)))

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
