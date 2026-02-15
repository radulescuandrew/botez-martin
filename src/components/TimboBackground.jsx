import { useMemo } from 'react'

const TIMBO_BASE = '/sprites/timbo_game'

// Single background: Night Sky 2 only
const SKY_NIGHT2_URL = `${TIMBO_BASE}/Background/Night%20Sky/Sky_Night2%20(1920x1080-1920x1080).png`

const PARALLAX = 0.12

export default function TimboBackground({ scrollOffset = 0 }) {
  const tx = useMemo(() => -scrollOffset * PARALLAX * 0.5, [scrollOffset])

  return (
    <div className="timbo-background">
      <div
        className="timbo-bg-layer"
        style={{ transform: `translate3d(${tx}px, 0, 0)` }}
        aria-hidden
      >
        <div className="timbo-bg-layer-inner">
          <img src={SKY_NIGHT2_URL} alt="" className="timbo-bg-layer-img" />
        </div>
      </div>
    </div>
  )
}
