import { useMemo } from 'react'

const TIMBO_BASE = '/sprites/timbo_game'

// Single background: Night Sky 2 only (tiled so long runs e.g. nightmare don't go black)
const SKY_NIGHT2_URL = `${TIMBO_BASE}/Background/Night%20Sky/Sky_Night2%20(1920x1080-1920x1080).png`
const PARALLAX = 0.12
const TILE_WIDTH_PX = 1920

export default function TimboBackground({ scrollOffset = 0 }) {
  const offsetPx = useMemo(() => {
    const raw = scrollOffset * PARALLAX * 0.5
    return ((raw % TILE_WIDTH_PX) + TILE_WIDTH_PX) % TILE_WIDTH_PX
  }, [scrollOffset])

  return (
    <div className="timbo-background">
      <div className="timbo-bg-layer" aria-hidden>
        <div
          className="timbo-bg-layer-inner timbo-bg-layer-tiled"
          style={{
            backgroundImage: `url("${SKY_NIGHT2_URL}")`,
            backgroundPosition: `${-offsetPx}px 0`,
          }}
        />
      </div>
    </div>
  )
}
