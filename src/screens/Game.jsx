import { useRef, useEffect, useState, useMemo } from 'react'
import { gsap } from 'gsap'
import ParallaxBackground from '../components/ParallaxBackground'
import { useGameLoop } from '../game/useGameLoop'
import { LEVEL } from '../game/level'

const BASE_CANVAS_WIDTH = 320
const BASE_CANVAS_HEIGHT = 180

const BOY_SPRITES_BASE = '/sprites/boy_sprites/Transparent%20PNG'
const PLANET_SPRITES_BASE = '/sprites/planet_sprites'
const EARTH_SPRITE = '/earth.png'
const PLANET_FILES = [
  'planet1.png',
  'planet2.png',
  'planet3.png',
  'planet4.png',
  'planet5.png',
  'planet6.png',
  'planet7.png',
  'planet10.png',
  'planet11.png',
  'planet12.png',
  'planet13.png',
  'planet14.png',
  'planet15.png',
  'planet16.png',
  'planet17.png',
  'planet18_0.png',
  'planet19.png',
  'planet20.png',
]

export default function Game({
  onReachEnd,
  attempts,
  username,
  onRetry,
  onBackToIntro,
  onRunStartAudio,
  onRunFailAudio,
}) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const flapRef = useRef(false)
  const boySpritesRef = useRef({ idle: [], jumpUp: null, jumpFall: null })
  const planetSpritesRef = useRef([])
  const earthSpriteRef = useRef(null)
  const runAudioTriggeredRef = useRef(false)
  const [gameOver, setGameOver] = useState(false)
  const [isMobile, setIsMobile] = useState(() => (
    window.matchMedia('(max-width: 900px), (pointer: coarse)').matches
  ))
  const logicalWidth = isMobile ? 512 : BASE_CANVAS_WIDTH
  const logicalHeight = isMobile ? 288 : BASE_CANVAS_HEIGHT

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px), (pointer: coarse)')
    const handleChange = () => setIsMobile(media.matches)
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const img = new Image()
    img.src = EARTH_SPRITE
    img.onload = () => {
      earthSpriteRef.current = img
    }
    return () => {
      earthSpriteRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loaded = []
    let completed = 0

    PLANET_FILES.forEach((file, index) => {
      const img = new Image()
      img.onload = () => {
        loaded[index] = img
        completed++
        if (completed === PLANET_FILES.length && !cancelled) {
          planetSpritesRef.current = loaded.filter(Boolean)
        }
      }
      img.src = `${PLANET_SPRITES_BASE}/${file}`
    })

    return () => {
      cancelled = true
      planetSpritesRef.current = []
    }
  }, [])

  const tunedLevel = useMemo(() => {
    if (!isMobile) return LEVEL
    const yScale = logicalHeight / BASE_CANVAS_HEIGHT
    const mobileGroundY = logicalHeight - 14
    return {
      ...LEVEL,
      groundY: mobileGroundY,
      scrollSpeed: LEVEL.scrollSpeed * 0.82,
      gates: LEVEL.gates.map((gate) => {
        const scaledGapHeight = Math.round(gate.gapHeight * yScale)
        const scaledGapY = Math.round(gate.gapY * yScale)
        const nextGapHeight = Math.min(scaledGapHeight + 12, Math.round(logicalHeight * 0.38))
        const maxGapY = Math.max(16, mobileGroundY - nextGapHeight - 12)
        return {
          ...gate,
          width: Math.max(30, Math.round(gate.width * 0.85)),
          gapHeight: nextGapHeight,
          gapY: Math.min(Math.max(12, scaledGapY), maxGapY),
        }
      }),
    }
  }, [isMobile, logicalHeight])

  useEffect(() => {
    const base = BOY_SPRITES_BASE
    const out = { idle: [], jumpUp: null, jumpFall: null }
    let loaded = 0
    const checkAll = () => {
      loaded++
      if (loaded === 4) boySpritesRef.current = out
    }

    const img1 = new Image()
    img1.onload = () => { out.idle[0] = img1; checkAll() }
    img1.src = `${base}/idle/frame-1.png`

    const img2 = new Image()
    img2.onload = () => { out.idle[1] = img2; checkAll() }
    img2.src = `${base}/idle/frame-2.png`

    const imgUp = new Image()
    imgUp.onload = () => { out.jumpUp = imgUp; checkAll() }
    imgUp.src = `${base}/jump/jump_up.png`

    const imgFall = new Image()
    imgFall.onload = () => { out.jumpFall = imgFall; checkAll() }
    imgFall.src = `${base}/jump/jump_fall.png`

    return () => {
      boySpritesRef.current = { idle: [], jumpUp: null, jumpFall: null }
    }
  }, [])

  const {
    scrollX,
    reset,
    gameStateRef,
  } = useGameLoop({
    level: tunedLevel,
    canvasWidth: logicalWidth,
    canvasHeight: logicalHeight,
    onReachEnd,
    onGameOver: () => setGameOver(true),
    flapRef,
    kidWidth: isMobile ? 17 : 18,
    kidHeight: isMobile ? 20 : 22,
    kidScreenRatio: isMobile ? 0.42 : 0.5,
  })

  const handleFlap = () => {
    flapRef.current = true
  }

  // Game over: show overlay (no auto-restart; user taps to try again)
  useEffect(() => {
    if (!gameOver) return
    runAudioTriggeredRef.current = false
    if (onRunFailAudio) onRunFailAudio()
    const overlay = overlayRef.current
    if (overlay) {
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    }
  }, [gameOver, onRunFailAudio])

  const handlePointerDown = (e) => {
    e.preventDefault()
    if (gameOver) {
      if (onRunStartAudio) onRunStartAudio()
      runAudioTriggeredRef.current = false
      if (onRetry) onRetry()
      reset()
      setGameOver(false)
    } else {
      if (scrollX <= 0 && onRunStartAudio && !runAudioTriggeredRef.current) {
        runAudioTriggeredRef.current = true
        onRunStartAudio()
      }
      handleFlap()
    }
  }

  useEffect(() => {
    if (!onRunStartAudio) return
    const handleKeyDown = (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        if (!gameOver && scrollX <= 0 && !runAudioTriggeredRef.current) {
          runAudioTriggeredRef.current = true
          onRunStartAudio()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onRunStartAudio, gameOver, scrollX])

  // Draw loop - canvas fills viewport, game logic stays 320x180
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !gameStateRef) return

    const ctx = canvas.getContext('2d')
    let rafId
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let lastW = 0
    let lastH = 0

    const draw = () => {
      const state = gameStateRef.current
      if (!state || !state.kid) return

      const cw = canvas.clientWidth || logicalWidth
      const ch = canvas.clientHeight || logicalHeight
      if (cw > 0 && ch > 0 && (lastW !== cw || lastH !== ch)) {
        lastW = cw
        lastH = ch
        canvas.width = cw * dpr
        canvas.height = ch * dpr
      }
      const w = lastW || logicalWidth
      const h = lastH || logicalHeight

      const scaleX = (w * dpr) / logicalWidth
      const scaleY = (h * dpr) / logicalHeight
      // Use cover so gameplay fills the viewport while preserving aspect ratio.
      const uniformScale = Math.max(scaleX, scaleY)
      const offsetX = (w * dpr - logicalWidth * uniformScale) / 2
      const offsetY = (h * dpr - logicalHeight * uniformScale) / 2

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w * dpr, h * dpr)
      ctx.setTransform(uniformScale, 0, 0, uniformScale, offsetX, offsetY)

      // Space floor at collision boundary.
      ctx.fillStyle = '#12081f'
      ctx.fillRect(0, state.groundY, logicalWidth * 2, logicalHeight - state.groundY)
      ctx.fillStyle = '#6a5acd'
      ctx.fillRect(0, state.groundY - 1.5, logicalWidth * 2, 2.5)

      // Individual planet obstacles at varied sizes/positions.
      if (state.planets) {
        state.planets.forEach((planet) => {
          const px = planet.x - state.scrollX
          const size = planet.kind === 'earth' ? planet.radius * 2.8 : planet.radius * 2
          if (px + planet.radius < -20 || px - planet.radius > logicalWidth + 20) return
          const spritePool = planetSpritesRef.current
          const img = planet.kind === 'earth'
            ? earthSpriteRef.current
            : (spritePool.length > 0 ? spritePool[planet.spriteIndex % spritePool.length] : null)
          if (img && img.complete && img.naturalWidth > 0) {
            const half = size / 2
            ctx.drawImage(img, px - half, planet.y - half, size, size)
            if (planet.kind === 'earth') {
              ctx.strokeStyle = 'rgba(134, 215, 255, 0.65)'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.arc(px, planet.y, planet.radius * 1.22, 0, Math.PI * 2)
              ctx.stroke()
            }
          } else {
            ctx.fillStyle = '#8c66ff'
            ctx.beginPath()
            ctx.arc(px, planet.y, planet.radius, 0, Math.PI * 2)
            ctx.fill()
          }
        })
      }

      // Kid (boy_sprites: idle / jump_up / jump_fall)
      const sprites = boySpritesRef.current
      const velY = state.kid.velY ?? 0
      let img = null
      if (velY < 0 && sprites.jumpUp && sprites.jumpUp.complete) {
        img = sprites.jumpUp
      } else if (velY > 0.3 && sprites.jumpFall && sprites.jumpFall.complete) {
        img = sprites.jumpFall
      } else if (sprites.idle.length === 2 && sprites.idle[0]?.complete) {
        const idx = Math.floor(Date.now() / 200) % 2
        img = sprites.idle[idx]
      }
      if (img && img.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(
          img,
          0, 0, img.naturalWidth, img.naturalHeight,
          state.kid.x, state.kid.y, state.kid.width, state.kid.height
        )
      } else {
        ctx.fillStyle = '#3498db'
        ctx.fillRect(state.kid.x, state.kid.y, state.kid.width, state.kid.height)
      }
    }

    draw()
    rafId = requestAnimationFrame(function loop() {
      draw()
      rafId = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStateRef, isMobile, logicalWidth, logicalHeight]) // Recreate when viewport profile changes

  return (
    <div
      className={`game-container ${isMobile ? 'mobile' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Tap to fly"
      onPointerDown={handlePointerDown}
    >
      {onBackToIntro && (
        <button
          type="button"
          className="game-back-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onBackToIntro()
          }}
        >
          Back to first page
        </button>
      )}
      <p className="game-attempts">Incercari: {attempts}</p>
      {username && <p className="game-username">Jucator: {username}</p>}
      <p className={`game-controls-hint ${scrollX > 0 ? 'hidden' : ''}`}>
        Tap or press space to start and fly
      </p>
      <ParallaxBackground scrollOffset={scrollX} />
      <canvas
        ref={canvasRef}
        className="game-canvas"
        tabIndex={-1}
      />
      {gameOver && (
        <div ref={overlayRef} className="game-over-overlay">
          <p>Game over! Tap to try again.</p>
        </div>
      )}
    </div>
  )
}
