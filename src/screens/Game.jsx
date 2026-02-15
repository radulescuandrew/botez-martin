import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { gsap } from 'gsap'
import TimboBackground from '../components/TimboBackground'
import BlackHoleTransition from '../components/BlackHoleTransition'
import { useGameLoop } from '../game/useGameLoop'
import { LEVEL } from '../game/level'

const BASE_CANVAS_WIDTH = 320
const BASE_CANVAS_HEIGHT = 180
const WIN_LANDED_MS = 3000
const WIN_TRANSITION_MS = 2200
const LAST_SCORE_KEY = 'martins_last_score'
const HIGH_SCORE_KEY = 'martins_high_score'
const BEST_SCORE_BY_DIFFICULTY_PREFIX = 'martins_best_score_'
const BASE_SCORE_UNIT = 10
const WIN_BONUS = 2000
const SCROLL_DIVISOR = 100

function scrollToScoreBase(scroll) {
  return Math.floor(scroll / SCROLL_DIVISOR) * BASE_SCORE_UNIT
}

function getDifficultyMultiplier(diff) {
  return diff === 'easy' ? 1 : diff === 'nightmare' ? 3 : 2
}

const BOY_SPRITES_BASE = '/sprites/boy_sprites_2'
const TIMBO_BASE = '/sprites/timbo_game'
const TOY_FILES = [
  'Toys/Watering-Can_Blue (1920x1080-93x61).png',
  'Toys/Car_1 (1920x1080-93x72).png',
  'Toys/Shovel_Blue (1920x1080-42x89).png',
  'Toys/Ball_Colorful (1920x1080-103x88).png',
  'Toys/Jumpball_Green (1920x1080-90x95).png',
]
const GOAL_SPRITE = "Goal - Napoleon's Home/Goal (Home)_byDay (1920x1080-966x531).png"

function timboAssetUrl(path) {
  return TIMBO_BASE + '/' + path.split('/').map((s) => encodeURIComponent(s)).join('/')
}

export default function Game({
  onReachEnd,
  attempts,
  username,
  difficulty = 'medium',
  onRetry,
  onBackToIntro,
  onChangeDifficulty,
  onRunStartAudio,
  onRunFailAudio,
  onEarthHit,
}) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const flapRef = useRef(false)
  const boySpritesRef = useRef({ idle: [], jumpUp: null, jumpFall: null })
  const toySpritesRef = useRef([])
  const goalSpriteRef = useRef(null)
  const runAudioTriggeredRef = useRef(false)
  const [gameOver, setGameOver] = useState(false)
  const [winPhase, setWinPhase] = useState('none') // none | landed | transition | video
  const [lastScore, setLastScore] = useState(() => Number.parseInt(localStorage.getItem(LAST_SCORE_KEY) || '0', 10) || 0)
  const [highScore, setHighScore] = useState(() => Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) || 0)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [winScore, setWinScore] = useState(null)
  const [isNewBestWin, setIsNewBestWin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [retryLocked, setRetryLocked] = useState(false)
  const [retryLockCycle, setRetryLockCycle] = useState(0)
  const [isMobile, setIsMobile] = useState(() => (
    window.matchMedia('(max-width: 900px), (pointer: coarse)').matches
  ))
  const winPhaseRef = useRef('none')
  const winTimerRef = useRef(null)
  const retryLockTimerRef = useRef(null)
  const winVideoRef = useRef(null)
  const logicalWidth = isMobile ? 400 : BASE_CANVAS_WIDTH
  const logicalHeight = isMobile ? 225 : BASE_CANVAS_HEIGHT
  const ignoreReachEndRef = useCallback(() => {}, [])
  const difficultyMultiplier = getDifficultyMultiplier(difficulty)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px), (pointer: coarse)')
    const handleChange = () => setIsMobile(media.matches)
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const img = new Image()
    img.src = timboAssetUrl(GOAL_SPRITE)
    img.onload = () => {
      goalSpriteRef.current = img
    }
    return () => {
      goalSpriteRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loaded = []
    let completed = 0

    TOY_FILES.forEach((file, index) => {
      const img = new Image()
      img.onload = () => {
        loaded[index] = img
        completed++
        if (completed === TOY_FILES.length && !cancelled) {
          toySpritesRef.current = loaded.filter(Boolean)
        }
      }
      img.src = timboAssetUrl(file)
    })

    return () => {
      cancelled = true
      toySpritesRef.current = []
    }
  }, [])

  const tunedLevel = useMemo(() => {
    let difficultyLevel = LEVEL
    if (difficulty === 'easy') {
      const easyGates = LEVEL.gates
        .filter((_, i) => i % 2 === 0)
        .map((gate) => ({
          ...gate,
          width: Math.max(34, gate.width - 4),
          gapHeight: gate.gapHeight + 14,
        }))
      difficultyLevel = {
        ...LEVEL,
        length: 2200,
        scrollSpeed: LEVEL.scrollSpeed * 0.86,
        gates: easyGates,
        planetProfile: { sideMode: 'none', radiusScale: 0.9 },
      }
    } else if (difficulty === 'nightmare') {
      const nightmareLength = 6800
      const midGates = []
      for (let i = 0; i < LEVEL.gates.length - 1; i += 1) {
        const a = LEVEL.gates[i]
        const b = LEVEL.gates[i + 1]
        const midGapH = Math.round((a.gapHeight + b.gapHeight) / 2)
        midGates.push({
          x: Math.round((a.x + b.x) / 2),
          gapY: Math.max(24, Math.round((a.gapY + b.gapY) / 2) + (i % 3 === 0 ? -5 : 4)),
          gapHeight: Math.max(54, midGapH + 2),
          width: Math.min(62, Math.max(50, Math.round((a.width + b.width) / 2) + 8)),
        })
      }
      const base = [...LEVEL.gates, ...midGates].sort((g1, g2) => g1.x - g2.x)
      const lastBaseX = base[base.length - 1].x
      const tailSpacing = 180
      const gateTemplates = base.slice(Math.floor(base.length * 0.35))
      const tailCount = Math.ceil((nightmareLength - lastBaseX - 250) / tailSpacing)
      const tail = Array.from({ length: tailCount }, (_, idx) => {
        const gate = gateTemplates[idx % gateTemplates.length]
        return {
          ...gate,
          x: lastBaseX + tailSpacing + idx * tailSpacing,
          gapHeight: Math.max(54, gate.gapHeight + 2),
          width: Math.min(62, Math.max(50, gate.width + 6)),
        }
      })
      difficultyLevel = {
        ...LEVEL,
        length: nightmareLength,
        scrollSpeed: LEVEL.scrollSpeed * 1.06,
        gates: [...base, ...tail],
        planetProfile: { sideMode: 'normal', radiusScale: 1.02 },
      }
    } else {
      difficultyLevel = {
        ...LEVEL,
        planetProfile: { sideMode: 'normal', radiusScale: 1 },
      }
    }

    if (!isMobile) return difficultyLevel
    const yScale = logicalHeight / BASE_CANVAS_HEIGHT
    const mobileGroundY = logicalHeight - 14
    const baseRadiusScale = difficultyLevel.planetProfile?.radiusScale ?? 1
    return {
      ...difficultyLevel,
      groundY: mobileGroundY,
      scrollSpeed: difficultyLevel.scrollSpeed * 0.82,
      planetProfile: {
        ...difficultyLevel.planetProfile,
        radiusScale: baseRadiusScale * 1.2,
      },
      gates: difficultyLevel.gates.map((gate) => {
        const scaledGapHeight = Math.round(gate.gapHeight * yScale)
        const scaledGapY = Math.round(gate.gapY * yScale)
        const minGapHeight = Math.max(48, Math.round(logicalHeight * 0.24))
        const nextGapHeight = Math.min(
          Math.max(scaledGapHeight + 10, minGapHeight),
          Math.round(logicalHeight * 0.42)
        )
        const maxGapY = Math.max(16, mobileGroundY - nextGapHeight - 8)
        return {
          ...gate,
          width: Math.max(44, Math.round(gate.width * 1.02)),
          gapHeight: nextGapHeight,
          gapY: Math.min(Math.max(12, scaledGapY), maxGapY),
        }
      }),
    }
  }, [isMobile, logicalHeight, difficulty])

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
    img1.src = `${base}/Idle%20(1).png`

    const img2 = new Image()
    img2.onload = () => { out.idle[1] = img2; checkAll() }
    img2.src = `${base}/Idle%20(2).png`

    const imgUp = new Image()
    imgUp.onload = () => { out.jumpUp = imgUp; checkAll() }
    imgUp.src = `${base}/Jump%20(2).png`

    const imgFall = new Image()
    imgFall.onload = () => { out.jumpFall = imgFall; checkAll() }
    imgFall.src = `${base}/Jump%20(8).png`

    return () => {
      boySpritesRef.current = { idle: [], jumpUp: null, jumpFall: null }
    }
  }, [])

  const kidCollisionInsets = isMobile
    ? { top: 8, bottom: 9, left: 4, right: 12 }
    : { top: 5, bottom: 5, left: 3, right: 9 }

  const {
    scrollX,
    reset,
    gameStateRef,
  } = useGameLoop({
    level: tunedLevel,
    canvasWidth: logicalWidth,
    canvasHeight: logicalHeight,
    onReachEnd: ignoreReachEndRef,
    onGameOver: () => setGameOver(true),
    flapRef,
    kidWidth: isMobile ? 28 : 18,
    kidHeight: isMobile ? 34 : 22,
    kidScreenRatio: isMobile ? 0.18 : 0.5,
    kidCollisionInsets,
  })
  const baseScore = scrollToScoreBase(scrollX) + (winPhase !== 'none' ? WIN_BONUS : 0)
  const score = baseScore * difficultyMultiplier

  const handleReachEarth = useCallback((payload) => {
    if (!payload?.earth || winPhaseRef.current !== 'none') return
    if (onEarthHit) onEarthHit()
    winPhaseRef.current = 'landed'
    setWinPhase('landed')

    const state = gameStateRef.current
    const scroll = payload.scrollX ?? state?.scrollX ?? 0
    if (state?.kid) {
      const earthScreenX = payload.earth.x - payload.scrollX
      const kidX = earthScreenX - state.kid.width / 2
      const kidY = payload.earth.y - payload.earth.radius - state.kid.height + 1
      const landedKid = { ...state.kid, x: kidX, y: kidY, velY: 0 }
      gameStateRef.current = { ...state, kid: landedKid, scrollX: payload.scrollX }
    }

    const baseScoreWin = scrollToScoreBase(scroll) + WIN_BONUS
    const finalScore = baseScoreWin * difficultyMultiplier
    localStorage.setItem(LAST_SCORE_KEY, String(finalScore))
    const storedHigh = Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) || 0
    localStorage.setItem(HIGH_SCORE_KEY, String(Math.max(storedHigh, finalScore)))
    const difficultyKey = BEST_SCORE_BY_DIFFICULTY_PREFIX + difficulty
    const storedBest = Number.parseInt(localStorage.getItem(difficultyKey) || '0', 10) || 0
    const isNewBest = finalScore > storedBest
    localStorage.setItem(difficultyKey, String(Math.max(storedBest, finalScore)))
    setWinScore(finalScore)
    setIsNewBestWin(isNewBest)

    winTimerRef.current = window.setTimeout(() => {
      winPhaseRef.current = 'transition'
      setWinPhase('transition')
      winTimerRef.current = window.setTimeout(() => {
        winPhaseRef.current = 'video'
        setWinPhase('video')
      }, WIN_TRANSITION_MS)
    }, WIN_LANDED_MS)
  }, [gameStateRef, onEarthHit, difficulty, difficultyMultiplier])

  useEffect(() => {
    return () => {
      if (winTimerRef.current) window.clearTimeout(winTimerRef.current)
      if (retryLockTimerRef.current) window.clearTimeout(retryLockTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (winPhase !== 'video' || !winVideoRef.current) return
    const video = winVideoRef.current
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.preload = 'auto'
    const p = video.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }, [winPhase])

  const handleFlap = () => {
    flapRef.current = true
  }

  // Game over: show overlay (no auto-restart; user taps to try again)
  useEffect(() => {
    if (!gameOver) return
    setRetryLocked(true)
    setRetryLockCycle((c) => c + 1)
    if (retryLockTimerRef.current) window.clearTimeout(retryLockTimerRef.current)
    retryLockTimerRef.current = window.setTimeout(() => {
      setRetryLocked(false)
    }, 2000)
    runAudioTriggeredRef.current = false
    if (onRunFailAudio) onRunFailAudio()

    const scroll = gameStateRef.current?.scrollX || 0
    const baseScoreNoWin = Math.max(0, scrollToScoreBase(scroll))
    const runScore = baseScoreNoWin * difficultyMultiplier
    setLastScore(runScore)
    localStorage.setItem(LAST_SCORE_KEY, String(runScore))

    const storedHigh = Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) || 0
    const baseHigh = Math.max(highScore, storedHigh)
    const nextHigh = Math.max(baseHigh, runScore)
    const reachedNewHigh = runScore >= baseHigh && runScore > 0
    setHighScore(nextHigh)
    setIsNewHighScore(reachedNewHigh)
    localStorage.setItem(HIGH_SCORE_KEY, String(nextHigh))
    const difficultyKey = BEST_SCORE_BY_DIFFICULTY_PREFIX + difficulty
    const storedBest = Number.parseInt(localStorage.getItem(difficultyKey) || '0', 10) || 0
    localStorage.setItem(difficultyKey, String(Math.max(storedBest, runScore)))

    const overlay = overlayRef.current
    if (overlay) {
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    }
  }, [gameOver, onRunFailAudio, gameStateRef, difficultyMultiplier, highScore, difficulty])

  const handleWinVideoEnd = useCallback(() => {
    onReachEnd()
  }, [onReachEnd])

  const handlePointerDown = (e) => {
    e.preventDefault()
    if (winPhaseRef.current !== 'none' || menuOpen) return
    if (gameOver) {
      if (retryLocked) return
      if (onRunStartAudio) onRunStartAudio()
      runAudioTriggeredRef.current = false
      setIsNewHighScore(false)
      if (onRetry) onRetry()
      reset()
      setGameOver(false)
      setRetryLocked(false)
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

      // Toys as gates + goal (timbo theme)
      if (state.planets) {
        const toyPool = toySpritesRef.current
        const goalImg = goalSpriteRef.current
        state.planets.forEach((planet) => {
          const px = planet.x - state.scrollX
          const size = planet.kind === 'earth' ? planet.radius * 2.8 : planet.radius * 2
          if (px + planet.radius < -20 || px - planet.radius > logicalWidth + 20) return

          if (planet.kind === 'earth') {
            const half = size / 2
            if (goalImg && goalImg.complete && goalImg.naturalWidth > 0) {
              ctx.drawImage(goalImg, px - half, planet.y - half, size, size)
            } else {
              ctx.fillStyle = '#4a9c6d'
              ctx.beginPath()
              ctx.arc(px, planet.y, planet.radius, 0, Math.PI * 2)
              ctx.fill()
            }
            return
          }

          const img = toyPool.length > 0 ? toyPool[planet.spriteIndex % toyPool.length] : null
          if (img && img.complete && img.naturalWidth > 0) {
            const half = size / 2
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, px - half, planet.y - half, size, size)
          } else {
            ctx.fillStyle = '#8c66ff'
            ctx.beginPath()
            ctx.arc(px, planet.y, planet.radius, 0, Math.PI * 2)
            ctx.fill()
          }
        })
      }

      // Kid (boy_sprites_2: Idle / Jump)
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
      // Debug: border around kid collision box (inset to match actual hitbox)
      const ins = kidCollisionInsets
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.strokeRect(
        state.kid.x + ins.left,
        state.kid.y + ins.top,
        state.kid.width - ins.left - ins.right,
        state.kid.height - ins.top - ins.bottom
      )
    }

    draw()
    rafId = requestAnimationFrame(function loop() {
      draw()
      rafId = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStateRef, isMobile, logicalWidth, logicalHeight]) // Recreate when viewport profile changes

  useEffect(() => {
    const earthPayload = gameStateRef.current?.earthHit
    if (earthPayload) {
      // Consume one-shot event from loop.
      gameStateRef.current.earthHit = null
      handleReachEarth(earthPayload)
    }
  })

  return (
    <div
      className={`game-container ${isMobile ? 'mobile' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Tap to fly"
      onPointerDown={handlePointerDown}
    >
      <button
        type="button"
        className="game-menu-btn"
        aria-label="Open menu"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen(true)
        }}
      >
        <span />
        <span />
        <span />
      </button>
      <p className="game-attempts">Incercari: {attempts}</p>
      {username && <p className="game-username">{username}</p>}
      <p className="game-score">Scor: {score}</p>
      <p className={`game-controls-hint ${scrollX > 0 ? 'hidden' : ''}`}>
        Tap or press space to start and fly
      </p>
      <TimboBackground scrollOffset={scrollX} />
      <canvas
        ref={canvasRef}
        className="game-canvas"
        tabIndex={-1}
      />
      {gameOver && (
        <div ref={overlayRef} className="game-over-overlay">
          {isNewHighScore && (
            <div className="highscore-celebration" aria-hidden="true">
              <p className="highscore-celebration-text">HIGH</p>
              <p className="highscore-celebration-text">SCORE</p>
            </div>
          )}
          <div className="game-over-card">
            <p className="game-over-title">Game over!</p>
            <p className="game-over-score">Last score: {lastScore}</p>
            <p className={`game-over-score ${isNewHighScore ? 'highscore-hit' : ''}`}>
              High score: {highScore}
            </p>
            {isNewHighScore && <p className="new-high-badge">New High Score</p>}
            {retryLocked ? (
              <div className="retry-bar-track">
                <div key={retryLockCycle} className="retry-bar-fill" />
              </div>
            ) : (
              <p className="game-over-hint">Tap to try again</p>
            )}
          </div>
        </div>
      )}
      {winPhase === 'landed' && (
        <div className="win-celebration-overlay">
          {isNewBestWin && (
            <div className="highscore-celebration win-celebration-badge" aria-hidden="true">
              <p className="highscore-celebration-text">RECORD</p>
              <p className="highscore-celebration-text">NOU</p>
            </div>
          )}
          <div className="game-over-card win-celebration-card">
            <p className="game-over-title win-celebration-title">Felicitari!</p>
            <p className="game-over-score">Scor: {winScore ?? 0}</p>
            {isNewBestWin && <p className="new-high-badge">Record nou la aceasta dificultate!</p>}
          </div>
        </div>
      )}
      {menuOpen && (
        <div
          className="game-menu-overlay"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="game-menu-panel"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h2>Meniu</h2>
            <button
              type="button"
              className="game-menu-action"
              onClick={() => {
                setMenuOpen(false)
                if (onChangeDifficulty) onChangeDifficulty()
              }}
            >
              Change difficulty
            </button>
            <button
              type="button"
              className="game-menu-action"
              onClick={() => {
                setMenuOpen(false)
                if (onBackToIntro) onBackToIntro()
              }}
            >
              Back to main menu
            </button>
            <button
              type="button"
              className="game-menu-close"
              onClick={() => setMenuOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {winPhase === 'transition' && (
        <BlackHoleTransition active durationMs={WIN_TRANSITION_MS} showStory={false} />
      )}
      {winPhase === 'video' && (
        <div className="win-video-overlay">
          <video
            ref={winVideoRef}
            className="win-video"
            src="/placenta.mp4"
            autoPlay
            muted
            preload="auto"
            playsInline
            onEnded={handleWinVideoEnd}
          />
        </div>
      )}
    </div>
  )
}
