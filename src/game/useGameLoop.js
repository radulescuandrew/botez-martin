import { useRef, useState, useCallback, useEffect } from 'react'

const GRAVITY = 0.36
const FLAP_VELOCITY = -3.9
const SIMULATION_SPEED = 1.7
const DEFAULT_KID_WIDTH = 18
const DEFAULT_KID_HEIGHT = 22
const GROUND_MARGIN = 4

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

function buildPlanets(gates, groundY, levelLength, canvasWidth) {
  const planets = []

  gates.forEach((gate, idx) => {
    const gapTop = gate.gapY
    const gapBottom = gate.gapY + gate.gapHeight
    const gapCenter = (gapTop + gapBottom) / 2
    const baseX = gate.x + gate.width / 2

    const topSeed = idx * 7 + 11
    const topRadius = 11 + Math.floor(seededUnit(topSeed) * 10)
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
    const bottomRadius = 12 + Math.floor(seededUnit(bottomSeed) * 11)
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
    if (idx % 2 === 0) {
      const midSeed = idx * 13 + 37
      const sideRadius = 8 + Math.floor(seededUnit(midSeed) * 8)
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
    }
  })

  const earthRadius = Math.max(22, Math.floor(canvasWidth * 0.065))
  const earthX = levelLength - Math.max(140, Math.floor(canvasWidth * 0.42))
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
    buildPlanets(level.gates || [], groundY, level.length, canvasWidth)
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
  const gameStateRef = useRef({ kid, planets, scrollX, groundY })
  const scrollSpeed = level.scrollSpeed ?? 3

  const reset = useCallback(() => {
    startedRef.current = false
    gameOverRef.current = false
    frameCountRef.current = 0
    const centerY = Math.floor((canvasHeight - kidHeight) / 2)
    kidRef.current = { y: centerY, velY: 0 }
    const resetPlanets = buildPlanets(level.gates || [], groundY, level.length, canvasWidth)
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
    gameStateRef.current = { kid: kidState, planets: resetPlanets, scrollX: 0, groundY }
    setRestartCounter((c) => c + 1)
  }, [level.gates, level.length, kidScreenX, canvasHeight, canvasWidth, groundY, kidWidth, kidHeight])

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
    const planetsData = buildPlanets(level.gates || [], groundY, level.length, canvasWidth)
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
        gameStateRef.current = { kid: kidState, planets: planetsData, scrollX: scr, groundY }
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
            onReachEnd()
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
  }, [level.gates, level.length, canvasWidth, groundY, scrollSpeed, onReachEnd, onGameOver, flapRef, restartCounter, kidWidth, kidHeight])

  return {
    kid,
    planets,
    scrollX,
    groundY,
    reset,
    gameStateRef,
  }
}
