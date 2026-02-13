import { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'
import ParallaxBackground from '../components/ParallaxBackground'
import { useGameLoop } from '../game/useGameLoop'
import { LEVEL } from '../game/level'

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 180

const BOY_SPRITES_BASE = '/sprites/boy_sprites/Transparent%20PNG'

export default function Game({ onReachEnd, attempts, username, onRetry, onBackToIntro }) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const flapRef = useRef(false)
  const boySpritesRef = useRef({ idle: [], jumpUp: null, jumpFall: null })
  const [gameOver, setGameOver] = useState(false)

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
    level: LEVEL,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    onReachEnd,
    onGameOver: () => setGameOver(true),
    flapRef,
  })

  const handleFlap = () => {
    flapRef.current = true
  }

  // Game over: show overlay (no auto-restart; user taps to try again)
  useEffect(() => {
    if (!gameOver) return
    const overlay = overlayRef.current
    if (overlay) {
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    }
  }, [gameOver])

  const handlePointerDown = (e) => {
    e.preventDefault()
    if (gameOver) {
      if (onRetry) onRetry()
      reset()
      setGameOver(false)
    } else {
      handleFlap()
    }
  }

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

      const cw = canvas.clientWidth || CANVAS_WIDTH
      const ch = canvas.clientHeight || CANVAS_HEIGHT
      if (cw > 0 && ch > 0 && (lastW !== cw || lastH !== ch)) {
        lastW = cw
        lastH = ch
        canvas.width = cw * dpr
        canvas.height = ch * dpr
      }
      const w = lastW || CANVAS_WIDTH
      const h = lastH || CANVAS_HEIGHT

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale((w * dpr) / CANVAS_WIDTH, (h * dpr) / CANVAS_HEIGHT)
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Ground
      ctx.fillStyle = '#5c4033'
      ctx.fillRect(0, state.groundY, CANVAS_WIDTH * 2, CANVAS_HEIGHT - state.groundY)

      // Gates: top and bottom obstacles (simple rects)
      if (state.gates) {
        state.gates.forEach((gate) => {
          const screenX = gate.x - state.scrollX
          if (screenX < -gate.width || screenX > CANVAS_WIDTH + 20) return
          ctx.fillStyle = '#7cb342'
          ctx.fillRect(screenX, 0, gate.width, gate.gapY)
          ctx.fillStyle = '#558b2f'
          ctx.fillRect(screenX, gate.gapY + gate.gapHeight, gate.width, state.groundY - (gate.gapY + gate.gapHeight))
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
  }, []) // Empty deps - read from ref, don't recreate loop

  return (
    <div
      className="game-container"
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
