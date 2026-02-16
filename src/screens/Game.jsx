import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { gsap } from 'gsap'
import TimboBackground from '../components/TimboBackground'
import BlackHoleTransition from '../components/BlackHoleTransition'
import LeaderboardModal from '../components/LeaderboardModal'
import { useGameLoop } from '../game/useGameLoop'
import { LEVEL } from '../game/level'
import { fetchLeaderboard } from '../lib/leaderboard'

const BASE_CANVAS_WIDTH = 320
const BASE_CANVAS_HEIGHT = 180
const PORTRAIT_WIDTH = 225
const PORTRAIT_HEIGHT = 400
const PORTRAIT_FIRST_OBSTACLE_OFFSET = 50
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

function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const COLLECTIBLE_EMOJIS = ['⭐', '💎', '🎯', '🌟', '💫']
function buildCollectibles(groundY, levelLength, startX, endX, step = 260) {
  const list = []
  let id = 0
  for (let x = startX; x < endX; x += step) {
    const t = id * 0.77
    const band = Math.floor(seededUnit(t) * 3)
    const points = band === 0 ? 200 : band === 1 ? 150 : 100
    let y
    if (band === 0) {
      y = 28 + Math.floor(seededUnit(t + 1) * 24)
    } else if (band === 1) {
      const mid = Math.floor(groundY * 0.5)
      y = mid - 20 + Math.floor(seededUnit(t + 2) * 40)
    } else {
      y = groundY - 45 + Math.floor(seededUnit(t + 3) * 30)
    }
    y = Math.max(24, Math.min(groundY - 24, y))
    list.push({
      id: `col-${id}-${x}`,
      x,
      y,
      points,
      emoji: COLLECTIBLE_EMOJIS[id % COLLECTIBLE_EMOJIS.length],
    })
    id += 1
  }
  return list
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

function getStoredScore(key) {
  const n = Number.parseInt(localStorage.getItem(key) || '0', 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
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
  onScoresChange,
  scoresFromSupabase,
  scoreSyncPending = false,
  scoreSyncFailed = false,
  scoreSyncComplete = false,
  scoreSyncError = '',
  onRetryScoreSave,
}) {
  const fromSupabase = scoresFromSupabase != null
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const flapRef = useRef(false)
  const boySpritesRef = useRef({ idle: [], jumpUp: null, jumpFall: null })
  const toySpritesRef = useRef([])
  const goalSpriteRef = useRef(null)
  const runAudioTriggeredRef = useRef(false)
  const [gameOver, setGameOver] = useState(false)
  const [winPhase, setWinPhase] = useState('none') // none | landed | transition | video
  const [lastScore, setLastScore] = useState(() =>
    fromSupabase ? (scoresFromSupabase.lastScore ?? 0) : getStoredScore(LAST_SCORE_KEY),
  )
  const [highScore, setHighScore] = useState(() =>
    fromSupabase ? (scoresFromSupabase.highScore ?? 0) : getStoredScore(HIGH_SCORE_KEY),
  )
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [winScore, setWinScore] = useState(null)
  const [isNewBestWin, setIsNewBestWin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [retryLocked, setRetryLocked] = useState(false)
  const [retryLockCycle, setRetryLockCycle] = useState(0)
  const [speedUpNotificationVisible, setSpeedUpNotificationVisible] = useState(false)
  const [collectibleBonus, setCollectibleBonus] = useState(0)
  const collectibleBonusRef = useRef(0)
  const collectSoundRef = useRef(null)
  const lastSpeedUpThousandsRef = useRef(0)
  const speedUpNotificationTimerRef = useRef(null)
  const [isMobile, setIsMobile] = useState(() => (
    window.matchMedia('(max-width: 900px), (pointer: coarse)').matches
  ))
  const winPhaseRef = useRef('none')
  const winTimerRef = useRef(null)
  const retryLockTimerRef = useRef(null)
  const winVideoRef = useRef(null)
  const [winVideoUnmuted, setWinVideoUnmuted] = useState(false)
  const logicalWidth = isMobile ? PORTRAIT_WIDTH : BASE_CANVAS_WIDTH
  const logicalHeight = isMobile ? PORTRAIT_HEIGHT : BASE_CANVAS_HEIGHT
  const ignoreReachEndRef = useCallback(() => {}, [])
  const difficultyMultiplier = getDifficultyMultiplier(difficulty)
  const topTenRows = useMemo(() => {
    const top10 = leaderboardRows.slice(0, 10).map((r) => ({ ...r }))
    const tenthScore = top10[9]?.high_score ?? 0
    const currentUsername = (username || '').trim()
    const alreadyInTop10 = currentUsername
      ? top10.some((r) => (r.username || '').trim().toLowerCase() === currentUsername.toLowerCase())
      : false
    if (!alreadyInTop10 && lastScore > 0 && (top10.length < 10 || lastScore >= tenthScore)) {
      const currentRow = {
        username: currentUsername || 'Tu',
        high_score: lastScore,
        best_difficulty: difficulty,
        total_attempts: attempts,
        isCurrentUser: true,
      }
      const withoutMe = top10.filter((r) => (r.username || '').trim().toLowerCase() !== currentUsername.toLowerCase())
      const merged = [...withoutMe, currentRow].sort((a, b) => (b.high_score ?? 0) - (a.high_score ?? 0))
      return merged.slice(0, 10)
    }
    if (currentUsername) {
      top10.forEach((r) => {
        if ((r.username || '').trim().toLowerCase() === currentUsername.toLowerCase()) r.isCurrentUser = true
      })
    }
    return top10
  }, [leaderboardRows, lastScore, username, difficulty, attempts])

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true)
    setLeaderboardError('')
    try {
      const rows = await fetchLeaderboard(50)
      setLeaderboardRows(rows)
    } catch (err) {
      setLeaderboardError(err?.message ?? 'Nu am putut incarca leaderboard-ul.')
      setLeaderboardRows([])
    } finally {
      setLeaderboardLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  useEffect(() => {
    if (leaderboardOpen) loadLeaderboard()
  }, [leaderboardOpen, loadLeaderboard])

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
      const easyGates = LEVEL.gates.map((gate) => ({
        ...gate,
        width: Math.max(34, gate.width - 4),
        gapHeight: gate.gapHeight + 14,
      }))
      const easyCollectibles = buildCollectibles(LEVEL.groundY, 2200, 450, 2050, 380)
      difficultyLevel = {
        ...LEVEL,
        length: 2200,
        scrollSpeed: LEVEL.scrollSpeed * 0.86,
        gates: easyGates,
        obstacles: easyGates,
        planetProfile: { sideMode: 'none', radiusScale: 0.9 },
        collectibles: easyCollectibles,
      }
    } else if (difficulty === 'nightmare') {
      const nightmareLength = 78000
      const firstX = 300
      const lastX = nightmareLength - 220
      const spacing = 130
      const numGates = Math.ceil((lastX - firstX) / spacing) + 1
      const nightmareGates = []
      const nightmareObstacles = []
      for (let i = 0; i < numGates; i += 1) {
        const x = firstX + i * spacing
        if (x > lastX) break
        const t = i * 0.42
        const gapH = Math.max(38, Math.min(46, Math.round(42 + Math.sin(t * 0.7) * 2)))
        const lowGapY = Math.round(LEVEL.groundY - 26 - gapH - 8)
        const highGapY = 22
        const gapY = i % 2 === 0 ? lowGapY : highGapY
        const gate = {
          x,
          gapY,
          gapHeight: gapH,
          width: Math.max(52, Math.min(60, Math.round(55 + Math.cos(t * 0.5) * 3))),
        }
        nightmareGates.push(gate)
        if (i % 3 === 2) {
          nightmareObstacles.push({ type: 'top', x: x + Math.floor(spacing * 0.4), width: 64 })
        } else {
          nightmareObstacles.push(gate)
        }
      }
      const collectibles = buildCollectibles(
        LEVEL.groundY,
        nightmareLength,
        firstX + 180,
        lastX - 180,
        240
      )
      difficultyLevel = {
        ...LEVEL,
        length: nightmareLength,
        scrollSpeed: LEVEL.scrollSpeed * 1.15,
        gates: nightmareGates,
        obstacles: nightmareObstacles,
        planetProfile: { sideMode: 'normal', radiusScale: 1.06 },
        collectibles,
      }
    } else if (difficulty === 'medium') {
      const mediumCollectibles = buildCollectibles(
        LEVEL.groundY,
        LEVEL.length,
        400,
        LEVEL.length - 200,
        320
      )
      difficultyLevel = {
        ...LEVEL,
        planetProfile: { sideMode: 'normal', radiusScale: 1 },
        collectibles: mediumCollectibles,
      }
    } else {
      difficultyLevel = {
        ...LEVEL,
        planetProfile: { sideMode: 'normal', radiusScale: 1 },
      }
    }

    if (!isMobile) return difficultyLevel
    const yScale = logicalHeight / BASE_CANVAS_HEIGHT
    const mobileGroundY = logicalHeight - 24
    const baseRadiusScale = difficultyLevel.planetProfile?.radiusScale ?? 1
    const scaledGates = difficultyLevel.gates.map((gate) => {
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
    })
    const offsetGates = scaledGates.map((g) => ({ ...g, x: g.x + PORTRAIT_FIRST_OBSTACLE_OFFSET }))
    let gateIndex = 0
    const scaledObstacles = difficultyLevel.obstacles.map((ob) => {
      if (ob.gapY != null && ob.gapHeight != null) {
        return offsetGates[gateIndex++]
      }
      return { ...ob, x: ob.x + PORTRAIT_FIRST_OBSTACLE_OFFSET }
    })
    const scaledCollectibles = difficultyLevel.collectibles
      ? difficultyLevel.collectibles.map((c) => ({
          ...c,
          x: c.x + PORTRAIT_FIRST_OBSTACLE_OFFSET,
          y: Math.round(c.y * yScale),
        }))
      : undefined
    return {
      ...difficultyLevel,
      length: difficultyLevel.length + PORTRAIT_FIRST_OBSTACLE_OFFSET,
      groundY: mobileGroundY,
      scrollSpeed: difficultyLevel.scrollSpeed * 0.82,
      planetProfile: {
        ...difficultyLevel.planetProfile,
        radiusScale: baseRadiusScale * 1.2,
      },
      gates: offsetGates,
      obstacles: scaledObstacles,
      collectibles: scaledCollectibles ?? difficultyLevel.collectibles,
    }
  }, [isMobile, logicalHeight, logicalWidth, difficulty])

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

  const getScrollSpeedMultiplier = useCallback(
    (scroll) => {
      if (difficulty !== 'nightmare') return 1
      const base = scrollToScoreBase(scroll)
      const displayScore = base * getDifficultyMultiplier('nightmare')
      const thousands = Math.floor(displayScore / 1000)
      return 1 + thousands * 0.015
    },
    [difficulty]
  )

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
    getScrollSpeedMultiplier,
    onCollect: (points) => {
      setCollectibleBonus((prev) => prev + points)
      if (!collectSoundRef.current) collectSoundRef.current = new Audio('/Mario Mushroom Sound Effect.mp3')
      collectSoundRef.current.currentTime = 0
      collectSoundRef.current.play().catch(() => {})
    },
    onReset: () => setCollectibleBonus(0),
  })
  collectibleBonusRef.current = collectibleBonus
  const baseScore = scrollToScoreBase(scrollX) + collectibleBonus + (winPhase !== 'none' ? WIN_BONUS : 0)
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

    const bonus = collectibleBonusRef.current
    const baseScoreWin = scrollToScoreBase(scroll) + bonus + WIN_BONUS
    const finalScore = baseScoreWin * difficultyMultiplier
    const prevHigh = fromSupabase ? (scoresFromSupabase?.highScore ?? 0) : getStoredScore(HIGH_SCORE_KEY)
    const nextHigh = Math.max(prevHigh, finalScore)
    const storedBest = fromSupabase
      ? (difficulty === 'easy'
          ? (scoresFromSupabase?.bestScoreEasy ?? 0)
          : difficulty === 'medium'
            ? (scoresFromSupabase?.bestScoreMedium ?? 0)
            : (scoresFromSupabase?.bestScoreNightmare ?? 0))
      : Number.parseInt(localStorage.getItem(BEST_SCORE_BY_DIFFICULTY_PREFIX + difficulty) || '0', 10) || 0
    const newBest = Math.max(storedBest, finalScore)
    const isNewBest = finalScore > storedBest

    if (!fromSupabase) {
      localStorage.setItem(LAST_SCORE_KEY, String(finalScore))
      localStorage.setItem(HIGH_SCORE_KEY, String(nextHigh))
      localStorage.setItem(BEST_SCORE_BY_DIFFICULTY_PREFIX + difficulty, String(newBest))
    }
    setWinScore(finalScore)
    setIsNewBestWin(isNewBest)
    if (onScoresChange) {
      onScoresChange({
        attempts,
        username: username ?? '',
        difficulty,
        lastScore: finalScore,
        highScore: nextHigh,
        bestScoreEasy: difficulty === 'easy' ? newBest : scoresFromSupabase?.bestScoreEasy ?? null,
        bestScoreMedium: difficulty === 'medium' ? newBest : scoresFromSupabase?.bestScoreMedium ?? null,
        bestScoreNightmare: difficulty === 'nightmare' ? newBest : scoresFromSupabase?.bestScoreNightmare ?? null,
      })
    }

    winTimerRef.current = window.setTimeout(() => {
      winPhaseRef.current = 'transition'
      setWinPhase('transition')
      winTimerRef.current = window.setTimeout(() => {
        winPhaseRef.current = 'video'
        setWinPhase('video')
      }, WIN_TRANSITION_MS)
    }, WIN_LANDED_MS)
  }, [gameStateRef, onEarthHit, difficulty, difficultyMultiplier, onScoresChange, fromSupabase, scoresFromSupabase])

  useEffect(() => {
    return () => {
      if (winTimerRef.current) window.clearTimeout(winTimerRef.current)
      if (retryLockTimerRef.current) window.clearTimeout(retryLockTimerRef.current)
      if (speedUpNotificationTimerRef.current) window.clearTimeout(speedUpNotificationTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (difficulty !== 'nightmare' || gameOver || winPhase !== 'none') return
    if (scrollX <= 0) {
      lastSpeedUpThousandsRef.current = 0
      return
    }
    const displayScore = scrollToScoreBase(scrollX) * difficultyMultiplier
    const currentThousands = Math.floor(displayScore / 1000)
    if (currentThousands >= 1 && currentThousands > lastSpeedUpThousandsRef.current) {
      lastSpeedUpThousandsRef.current = currentThousands
      setSpeedUpNotificationVisible(true)
      if (speedUpNotificationTimerRef.current) window.clearTimeout(speedUpNotificationTimerRef.current)
      speedUpNotificationTimerRef.current = window.setTimeout(() => {
        setSpeedUpNotificationVisible(false)
        speedUpNotificationTimerRef.current = null
      }, 2500)
    }
  }, [scrollX, difficulty, difficultyMultiplier, gameOver, winPhase])

  useEffect(() => {
    if (gameOver) setSpeedUpNotificationVisible(false)
  }, [gameOver])

  useEffect(() => {
    if (winPhase !== 'video' || !winVideoRef.current) return
    const video = winVideoRef.current
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const p = video.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }, [winPhase])

  const handleUnmuteWinVideo = () => {
    const video = winVideoRef.current
    if (video) {
      video.muted = false
      setWinVideoUnmuted(true)
    }
  }

  const handleFlap = () => {
    flapRef.current = true
  }

  const gameOverHandledRef = useRef(false)

  // Game over: show overlay (no auto-restart; user taps to try again). Run only once per game over to avoid loop when App updates scores.
  useEffect(() => {
    if (!gameOver) {
      gameOverHandledRef.current = false
      return
    }
    if (gameOverHandledRef.current) return
    gameOverHandledRef.current = true

    setRetryLocked(true)
    setRetryLockCycle((c) => c + 1)
    if (retryLockTimerRef.current) window.clearTimeout(retryLockTimerRef.current)
    retryLockTimerRef.current = window.setTimeout(() => {
      setRetryLocked(false)
    }, 2000)
    runAudioTriggeredRef.current = false
    if (onRunFailAudio) onRunFailAudio()

    const scroll = gameStateRef.current?.scrollX || 0
    const bonus = collectibleBonusRef.current
    const baseScoreNoWin = Math.max(0, scrollToScoreBase(scroll) + bonus)
    const runScore = baseScoreNoWin * difficultyMultiplier
    setLastScore(runScore)

    const prevHigh = fromSupabase ? (scoresFromSupabase?.highScore ?? 0) : getStoredScore(HIGH_SCORE_KEY)
    const baseHigh = Math.max(highScore, prevHigh)
    const nextHigh = Math.max(baseHigh, runScore)
    const reachedNewHigh = runScore >= baseHigh && runScore > 0
    setHighScore(nextHigh)
    setIsNewHighScore(reachedNewHigh)

    const storedBest = fromSupabase
      ? (difficulty === 'easy'
          ? (scoresFromSupabase?.bestScoreEasy ?? 0)
          : difficulty === 'medium'
            ? (scoresFromSupabase?.bestScoreMedium ?? 0)
            : (scoresFromSupabase?.bestScoreNightmare ?? 0))
      : Number.parseInt(localStorage.getItem(BEST_SCORE_BY_DIFFICULTY_PREFIX + difficulty) || '0', 10) || 0
    const newBest = Math.max(storedBest, runScore)

    if (!fromSupabase) {
      localStorage.setItem(LAST_SCORE_KEY, String(runScore))
      localStorage.setItem(HIGH_SCORE_KEY, String(nextHigh))
      localStorage.setItem(BEST_SCORE_BY_DIFFICULTY_PREFIX + difficulty, String(newBest))
    }
    if (onScoresChange) {
      onScoresChange({
        attempts,
        username: username ?? '',
        difficulty,
        lastScore: runScore,
        highScore: nextHigh,
        bestScoreEasy: difficulty === 'easy' ? newBest : scoresFromSupabase?.bestScoreEasy ?? null,
        bestScoreMedium: difficulty === 'medium' ? newBest : scoresFromSupabase?.bestScoreMedium ?? null,
        bestScoreNightmare: difficulty === 'nightmare' ? newBest : scoresFromSupabase?.bestScoreNightmare ?? null,
      })
    }

    const overlay = overlayRef.current
    if (overlay) {
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    }
  }, [gameOver, onRunFailAudio, gameStateRef, difficultyMultiplier, highScore, difficulty, onScoresChange, fromSupabase, scoresFromSupabase])

  const handleWinVideoEnd = useCallback(() => {
    onReachEnd()
  }, [onReachEnd])

  const handlePointerDown = (e) => {
    e.preventDefault()
    if (winPhaseRef.current !== 'none' || menuOpen || leaderboardOpen) return
    if (gameOver) {
      if (retryLocked || scoreSyncPending) return
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
      const target = document.activeElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')) return
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
            // "Home" label + arrow when earth is visible or near
            if (px > -planet.radius - 30 && px < logicalWidth + planet.radius + 30) {
              const labelY = planet.y - planet.radius - 22
              ctx.save()
              ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
              ctx.lineWidth = 2
              ctx.font = 'bold 14px system-ui, sans-serif'
              ctx.textAlign = 'center'
              const homeText = 'Home'
              ctx.strokeText(homeText, px, labelY)
              ctx.fillText(homeText, px, labelY)
              // Arrow pointing down toward earth
              const arrowY = labelY + 10
              ctx.fillStyle = 'rgba(255, 255, 200, 0.95)'
              ctx.beginPath()
              ctx.moveTo(px, arrowY + 8)
              ctx.lineTo(px - 6, arrowY - 4)
              ctx.lineTo(px + 6, arrowY - 4)
              ctx.closePath()
              ctx.stroke()
              ctx.fill()
              ctx.restore()
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

      // Collectibles (emojis)
      if (state.collectibles && state.collectedIds) {
        state.collectibles.forEach((c) => {
          if (state.collectedIds.has(c.id)) return
          const px = c.x - state.scrollX
          if (px < -24 || px > logicalWidth + 24) return
          ctx.save()
          ctx.font = '24px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 4
          ctx.fillText(c.emoji, px, c.y)
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillStyle = 'rgba(255, 255, 200, 0.95)'
          ctx.fillText(`+${c.points}`, px, c.y + 18)
          ctx.restore()
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
      {difficulty === 'nightmare' && speedUpNotificationVisible && (
        <div className="game-speed-up-notification" role="status" aria-live="polite">
          Let&apos;s speed up 👿
        </div>
      )}
      <p className="game-attempts">Incercari: {attempts}</p>
      {username && <p className="game-username">{username}</p>}
      <div className="game-score-block">
        <p className="game-score">Scor: {score}</p>
        <p className="game-high-score">Best: {highScore}</p>
      </div>
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
          <div className="game-over-card">
            <p className="game-over-title">Game over!</p>
            <p className="game-over-score">Last score: {lastScore}</p>
            <p className={`game-over-score ${isNewHighScore ? 'highscore-hit' : ''}`}>
              High score: {highScore}
            </p>
            {isNewHighScore && <p className="new-high-badge">New High Score</p>}
            {topTenRows.length > 0 && (
              <div className="gameover-top3 gameover-top10">
                <p className="gameover-top3-title">Top 10 performante</p>
                {topTenRows.map((row, idx) => {
                  const raw = row.best_difficulty ?? row.difficulty ?? 'medium'
                  const d = raw === 'easy' || raw === 'nightmare' ? raw : 'medium'
                  const displayName = row.isCurrentUser ? `${row.username || 'Tu'} (tu)` : (row.username || '(anonim)')
                  return (
                    <p key={`top10-${idx}-${row.username ?? ''}-${row.high_score ?? 0}`} className={`gameover-top3-row${row.isCurrentUser ? ' gameover-top3-row-you' : ''}`}>
                      {idx + 1}. {displayName} - {row.high_score ?? 0}{' '}
                      <span className={`difficulty-badge difficulty-badge-${d}`} title={d} aria-label={d}>
                        {d === 'easy' ? 'E' : d === 'nightmare' ? 'N' : 'M'}
                      </span>{' '}
                      - {row.total_attempts ?? 0} incercari
                    </p>
                  )
                })}
              </div>
            )}
            {(retryLocked || scoreSyncPending) && (
              <div className="retry-bar-track">
                <div key={retryLockCycle} className="retry-bar-fill" />
              </div>
            )}
            {scoreSyncPending && (
              <p className="game-over-hint game-over-saving">Se salveaza scorul...</p>
            )}
            {scoreSyncComplete && retryLocked && (
              <p className="game-over-hint game-over-sync-done">Score sync complete</p>
            )}
            {scoreSyncFailed && onRetryScoreSave && (
              <div className="game-over-save-failed">
                <p className="game-over-hint">{scoreSyncError || 'Scorul nu s-a salvat.'}</p>
                <button type="button" className="rsvp-submit game-over-retry-save" onClick={(e) => { e.stopPropagation(); onRetryScoreSave() }}>
                  Incearca din nou
                </button>
              </div>
            )}
            {!retryLocked && !scoreSyncPending && (
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
              className="game-menu-action"
              onClick={() => {
                setMenuOpen(false)
                setLeaderboardOpen(true)
              }}
            >
              Leaderboard
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
      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        rows={leaderboardRows}
        loading={leaderboardLoading}
        error={leaderboardError}
      />
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
          {!winVideoUnmuted && (
            <button
              type="button"
              className="win-video-unmute-btn"
              onClick={handleUnmuteWinVideo}
              aria-label="Play video with sound"
            >
              <span className="win-video-unmute-icon" aria-hidden>🔊</span>
              <span className="win-video-unmute-text">Apasa pentru sunet</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
