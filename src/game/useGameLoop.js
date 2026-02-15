import { useRef, useState, useCallback, useEffect } from 'react'

const GRAVITY = 0.36
const FLAP_VELOCITY = -3.9
const SIMULATION_SPEED = 1.7
const DEFAULT_KID_WIDTH = 18
const DEFAULT_KID_HEIGHT = 22
const GROUND_MARGIN = 4
const DEV_FAST_FINISH_STORAGE_KEY = 'dev_fast_finish'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function checkCircleAABB(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width)
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height)
  const dx = circle.x - closestX
  const dy = circle.y - closestY
  return dx * dx + dy * dy < circle.radius * circle.radius
}

function isDevFastFinishEnabled() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  const fromQuery = new URLSearchParams(window.location.search).get('dev_fast_finish')
  const fromStorage = window.localStorage.getItem(DEV_FAST_FINISH_STORAGE_KEY)
  return fromQuery === '1' || fromStorage === '1'
}

function buildPlanets(gates, groundY, levelLength, canvasWidth, devFastFinish = false, planetProfile = {}) {
  const planets = []
  const sourceGates = devFastFinish ? gates.slice(0, 3) : gates
  const radiusScale = planetProfile.radiusScale ?? 1
  const sideMode = planetProfile.sideMode ?? 'normal'

  sourceGates.forEach((gate, idx) => {
    const gapTop = gate.gapY
    const gapBottom = gate.gapY + gate.gapHeight
    const gapCenter = (gapTop + gapBottom) / 2
    const baseX = gate.x + gate.width / 2

    const topSeed = idx * 7 + 11
    const topRadius = Math.round((11 + Math.floor(seededUnit(topSeed) * 10)) * radiusScale)
    const topYIdeal = gapTop - topRadius - 8 - Math.floor(seededUnit(topSeed + 1) * 7)
    const topY = clamp(topYIdeal, topRadius + 4, Math.max(topRadius + 4, gapTop - topRadius - 2))
    const topX = baseX + Math.floor((seededUnit(topSeed + 2) - 0.5) * 20)
    planets.push({
      x: topX,
      y: topY,
      radius: topRadius,
      spriteIndex: Math.floor(seededUnit(topSeed + 3) * 1000),
    })

    const bottomSeed = idx * 9 + 23
    const bottomRadius = Math.round((12 + Math.floor(seededUnit(bottomSeed) * 11)) * radiusScale)
    const bottomYIdeal = gapBottom + bottomRadius + 8 + Math.floor(seededUnit(bottomSeed + 1) * 7)
    const bottomY = clamp(
      bottomYIdeal,
      gapBottom + bottomRadius + 2,
      groundY - bottomRadius - 4
    )
    const bottomX = baseX + Math.floor((seededUnit(bottomSeed + 2) - 0.5) * 20)
    planets.push({
      x: bottomX,
      y: bottomY,
      radius: bottomRadius,
      spriteIndex: Math.floor(seededUnit(bottomSeed + 3) * 1000),
    })

    // Add occasional side planets to create a more "field of planets" feel.
    if (sideMode !== 'none' && idx % 2 === 0) {
      const midSeed = idx * 13 + 37
      const sideRadius = Math.round((8 + Math.floor(seededUnit(midSeed) * 8)) * radiusScale)
      const sideDir = idx % 4 < 2 ? -1 : 1
      const sideX = baseX + sideDir * (14 + Math.floor(seededUnit(midSeed + 1) * 24))
      const sideY = clamp(
        gapCenter + sideDir * (8 + Math.floor(seededUnit(midSeed + 2) * 14)),
        sideRadius + 4,
        groundY - sideRadius - 4
      )
      planets.push({
        x: sideX,
        y: sideY,
        radius: sideRadius,
        spriteIndex: Math.floor(seededUnit(midSeed + 3) * 1000),
      })

      if (sideMode === 'dense') {
        const extraSeed = idx * 17 + 51
        const extraRadius = Math.round((7 + Math.floor(seededUnit(extraSeed) * 8)) * radiusScale)
        const extraY = clamp(
          gapCenter + Math.floor((seededUnit(extraSeed + 1) - 0.5) * 34),
          extraRadius + 4,
          groundY - extraRadius - 4
        )
        const extraX = baseX + Math.floor((seededUnit(extraSeed + 2) - 0.5) * 56)
        planets.push({
          x: extraX,
          y: extraY,
          radius: extraRadius,
          spriteIndex: Math.floor(seededUnit(extraSeed + 3) * 1000),
        })
      }
    }
  })

  const earthRadius = devFastFinish
    ? Math.max(30, Math.floor(canvasWidth * 0.09))
    : Math.max(22, Math.floor(canvasWidth * 0.065))
  const earthX = devFastFinish
    ? canvasWidth + Math.max(110, Math.floor(canvasWidth * 0.22))
    : levelLength - Math.max(140, Math.floor(canvasWidth * 0.42))
  const earthY = clamp(Math.floor(groundY * 0.5), earthRadius + 12, groundY - earthRadius - 8)
  planets.push({
    x: earthX,
    y: earthY,
    radius: earthRadius,
    spriteIndex: 0,
    kind: 'earth',
  })

  return planets
}

export function useGameLoop({
  level,
  canvasWidth,
  canvasHeight,
  onReachEnd,
  onGameOver,
  flapRef,
  kidWidth = DEFAULT_KID_WIDTH,
  kidHeight = DEFAULT_KID_HEIGHT,
  kidScreenRatio = 0.5,
}) {
  const devFastFinish = isDevFastFinishEnabled()
  const groundY = level.groundY ?? canvasHeight - 24
  const kidScreenX = Math.floor(canvasWidth * kidScreenRatio - kidWidth / 2)
  const startY = Math.floor((canvasHeight - kidHeight) / 2)
  const [kid, setKid] = useState({
    x: kidScreenX,
    y: startY,
    width: kidWidth,
    height: kidHeight,
    velY: 0,
  })
  const [planets, setPlanets] = useState(() =>
    buildPlanets(level.gates || [], groundY, level.length, canvasWidth, devFastFinish, level.planetProfile)
  )
  const [scrollX, setScrollX] = useState(0)
  const [restartCounter, setRestartCounter] = useState(0)
  const kidRef = useRef({
    y: startY,
    velY: 0,
  })
  const kidScreenXRef = useRef(kidScreenX)
  const scrollRef = useRef(0)
  const startedRef = useRef(false)
  const gameOverRef = useRef(false)
  const frameCountRef = useRef(0)
  const gameStateRef = useRef({ kid, planets, scrollX, groundY, earthHit: null })
  const scrollSpeed = level.scrollSpeed ?? 3

  const reset = useCallback(() => {
    startedRef.current = false
    gameOverRef.current = false
    frameCountRef.current = 0
    const centerY = Math.floor((canvasHeight - kidHeight) / 2)
    kidRef.current = { y: centerY, velY: 0 }
    const resetPlanets = buildPlanets(
      level.gates || [],
      groundY,
      level.length,
      canvasWidth,
      devFastFinish,
      level.planetProfile
    )
    const kidState = {
      x: kidScreenX,
      y: centerY,
      width: kidWidth,
      height: kidHeight,
      velY: 0,
    }
    setKid(kidState)
    setPlanets(resetPlanets)
    scrollRef.current = 0
    setScrollX(0)
    gameStateRef.current = { kid: kidState, planets: resetPlanets, scrollX: 0, groundY, earthHit: null }
    setRestartCounter((c) => c + 1)
  }, [level.gates, level.length, level.planetProfile, kidScreenX, canvasHeight, canvasWidth, groundY, kidWidth, kidHeight, devFastFinish])

  useEffect(() => {
    kidScreenXRef.current = kidScreenX
  }, [kidScreenX])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault()
        if (flapRef) flapRef.current = true
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [flapRef])

  useEffect(() => {
    let rafId
    const planetsData = buildPlanets(
      level.gates || [],
      groundY,
      level.length,
      canvasWidth,
      devFastFinish,
      level.planetProfile
    )
    const earth = planetsData.find((p) => p.kind === 'earth')

    let lastFrameTime = null

    const tick = (now) => {
      if (gameOverRef.current) return

      if (lastFrameTime === null) {
        lastFrameTime = now
      }
      const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 1 / 30)
      lastFrameTime = now
      const step = deltaSeconds * 60 * SIMULATION_SPEED

      const k = kidRef.current
      const scr = scrollRef.current

      if (!startedRef.current) {
        if (flapRef?.current) {
          startedRef.current = true
          k.velY = FLAP_VELOCITY
          flapRef.current = false
        }
        const kidState = {
          x: kidScreenXRef.current,
          y: k.y,
          width: kidWidth,
          height: kidHeight,
          velY: k.velY,
        }
        setKid(kidState)
        setPlanets(planetsData)
        setScrollX(scr)
        gameStateRef.current = { kid: kidState, planets: planetsData, scrollX: scr, groundY, earthHit: null }
        rafId = requestAnimationFrame(tick)
        return
      }

      if (flapRef?.current) {
        k.velY = FLAP_VELOCITY
        flapRef.current = false
      }
      k.velY += GRAVITY * step
      k.y += k.velY * step

      if (k.y < 0 || k.y + kidHeight > groundY + GROUND_MARGIN) {
        gameOverRef.current = true
        onGameOver()
        return
      }

      scrollRef.current = scr + scrollSpeed * step
      const newScroll = scrollRef.current
      setScrollX(newScroll)

      const kx = kidScreenXRef.current
      const kidBox = {
        x: kx,
        y: k.y,
        width: kidWidth,
        height: kidHeight,
      }

      for (const planet of planetsData) {
        const screenX = planet.x - newScroll
        if (screenX + planet.radius < kx - 24 || screenX - planet.radius > kx + kidWidth + 24) continue
        const circle = {
          x: screenX,
          y: planet.y,
          radius: planet.kind === 'earth' ? planet.radius * 1.15 : planet.radius * 0.9,
        }
        if (checkCircleAABB(circle, kidBox)) {
          if (planet.kind === 'earth') {
            const kidState = {
              x: kidScreenXRef.current,
              y: k.y,
              width: kidWidth,
              height: kidHeight,
              velY: 0,
            }
            gameStateRef.current = {
              kid: kidState,
              planets: planetsData,
              scrollX: newScroll,
              groundY,
              earthHit: {
                earth: planet,
                scrollX: newScroll,
              },
            }
            setKid(kidState)
            setPlanets(planetsData)
            setScrollX(newScroll)
            if (typeof onReachEnd === 'function') {
              onReachEnd({
                earth: planet,
                scrollX: newScroll,
              })
            }
          } else {
            gameOverRef.current = true
            onGameOver()
          }
          return
        }
      }

      // Earth must be hit to win; missing it ends the run.
      if (earth && newScroll > earth.x + earth.radius + 30) {
        gameOverRef.current = true
        onGameOver()
        return
      }

      frameCountRef.current++
      const kidState = {
        x: kidScreenXRef.current,
        y: k.y,
        width: kidWidth,
        height: kidHeight,
        velY: k.velY,
      }

      // Update ref every frame (for draw loop), but throttle state updates
      gameStateRef.current = { kid: kidState, planets: planetsData, scrollX: newScroll, groundY }

      // Only update React state every 2 frames to reduce re-renders
      if (frameCountRef.current % 2 === 0) {
        setKid(kidState)
        setPlanets(planetsData)
        setScrollX(newScroll)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [level.gates, level.length, level.planetProfile, canvasWidth, groundY, scrollSpeed, onReachEnd, onGameOver, flapRef, restartCounter, kidWidth, kidHeight, devFastFinish])

  return {
    kid,
    planets,
    scrollX,
    groundY,
    reset,
    gameStateRef,
  }
}
