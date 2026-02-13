import { useRef, useState, useCallback, useEffect } from 'react'

const GRAVITY = 0.28
const FLAP_VELOCITY = -3.2
const KID_WIDTH = 20
const KID_HEIGHT = 20
const GAP_MARGIN = 3
const GROUND_MARGIN = 4

function checkAABB(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function useGameLoop({
  level,
  canvasWidth,
  canvasHeight,
  onReachEnd,
  onGameOver,
  flapRef,
}) {
  const groundY = level.groundY ?? canvasHeight - 24
  const kidScreenX = Math.floor((canvasWidth - KID_WIDTH) / 2)
  const startY = Math.floor((canvasHeight - KID_HEIGHT) / 2)
  const [kid, setKid] = useState({
    x: kidScreenX,
    y: startY,
    width: KID_WIDTH,
    height: KID_HEIGHT,
    velY: 0,
  })
  const [gates, setGates] = useState(() => [...(level.gates || [])])
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
  const gameStateRef = useRef({ kid, gates, scrollX, groundY })
  const scrollSpeed = level.scrollSpeed ?? 3
  const endThreshold = level.length - canvasWidth - 100

  const reset = useCallback(() => {
    startedRef.current = false
    gameOverRef.current = false
    frameCountRef.current = 0
    const centerY = Math.floor((canvasHeight - KID_HEIGHT) / 2)
    kidRef.current = { y: centerY, velY: 0 }
    const resetGates = [...(level.gates || [])]
    const kidState = {
      x: kidScreenX,
      y: centerY,
      width: KID_WIDTH,
      height: KID_HEIGHT,
      velY: 0,
    }
    setKid(kidState)
    setGates(resetGates)
    scrollRef.current = 0
    setScrollX(0)
    gameStateRef.current = { kid: kidState, gates: resetGates, scrollX: 0, groundY }
    setRestartCounter((c) => c + 1)
  }, [level.gates, kidScreenX, canvasHeight, groundY])

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
    const gatesData = [...(level.gates || [])]

    const tick = () => {
      if (gameOverRef.current) return

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
          width: KID_WIDTH,
          height: KID_HEIGHT,
          velY: k.velY,
        }
        setKid(kidState)
        setGates(gatesData)
        setScrollX(scr)
        gameStateRef.current = { kid: kidState, gates: gatesData, scrollX: scr, groundY }
        rafId = requestAnimationFrame(tick)
        return
      }

      if (flapRef?.current) {
        k.velY = FLAP_VELOCITY
        flapRef.current = false
      }
      k.velY += GRAVITY
      k.y += k.velY

      if (k.y < 0 || k.y + KID_HEIGHT > groundY + GROUND_MARGIN) {
        gameOverRef.current = true
        onGameOver()
        return
      }

      scrollRef.current = scr + scrollSpeed
      const newScroll = scrollRef.current
      setScrollX(newScroll)

      const kx = kidScreenXRef.current
      const kidBox = {
        x: kx,
        y: k.y,
        width: KID_WIDTH,
        height: KID_HEIGHT,
      }

      for (const gate of gatesData) {
        const screenX = gate.x - newScroll
        if (screenX + gate.width < kx - 10 || screenX > kx + KID_WIDTH + 10) continue
        const topRect = {
          x: screenX,
          y: 0,
          width: gate.width,
          height: Math.max(0, gate.gapY - GAP_MARGIN),
        }
        const bottomRect = {
          x: screenX,
          y: gate.gapY + gate.gapHeight + GAP_MARGIN,
          width: gate.width,
          height: Math.max(0, groundY - (gate.gapY + gate.gapHeight) - GAP_MARGIN),
        }
        if (checkAABB(kidBox, topRect) || checkAABB(kidBox, bottomRect)) {
          gameOverRef.current = true
          onGameOver()
          return
        }
      }

      if (newScroll >= endThreshold) {
        onReachEnd()
        return
      }

      frameCountRef.current++
      const kidState = {
        x: kidScreenXRef.current,
        y: k.y,
        width: KID_WIDTH,
        height: KID_HEIGHT,
        velY: k.velY,
      }
      
      // Update ref every frame (for draw loop), but throttle state updates
      gameStateRef.current = { kid: kidState, gates: gatesData, scrollX: newScroll, groundY }
      
      // Only update React state every 2 frames to reduce re-renders
      if (frameCountRef.current % 2 === 0) {
        setKid(kidState)
        setGates(gatesData)
        setScrollX(newScroll)
      }
      
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [level.gates, canvasWidth, groundY, scrollSpeed, endThreshold, onReachEnd, onGameOver, flapRef, restartCounter])

  return {
    kid,
    gates,
    scrollX,
    groundY,
    reset,
    gameStateRef,
  }
}
