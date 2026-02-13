import { useRef } from 'react'
import { gsap } from 'gsap'

export default function Landing({ onPlay }) {
  const containerRef = useRef(null)
  const titleRef = useRef(null)
  const subtitleRef = useRef(null)
  const buttonRef = useRef(null)

  const handlePlay = () => {
    const container = containerRef.current
    if (container) {
      gsap.to(container, {
        opacity: 0,
        duration: 0.4,
        onComplete: onPlay,
      })
    } else {
      onPlay()
    }
  }

  return (
    <div ref={containerRef} className="screen landing-screen">
      <h1 ref={titleRef} className="landing-title">
        You're Invited!
      </h1>
      <p ref={subtitleRef} className="landing-subtitle">
        To a very special baptism celebration
      </p>
      <p className="landing-date">Save the date — we can't wait to see you there.</p>
      <button
        ref={buttonRef}
        type="button"
        className="landing-play-btn"
        onClick={handlePlay}
      >
        Play
      </button>
    </div>
  )
}
