import { useRef, useState, useEffect } from 'react'
import { gsap } from 'gsap'
import RSVPForm from '../components/RSVPForm'

export default function EndScreen() {
  const containerRef = useRef(null)
  const thankYouRef = useRef(null)
  const [submitted, setSubmitted] = useState(false)
  const [rsvpData, setRsvpData] = useState(null)

  const handleSubmit = (data) => {
    setRsvpData(data)
    setSubmitted(true)
    // Stub: later replace with fetch('/api/rsvp', { method: 'POST', body: JSON.stringify(data) })
  }

  useEffect(() => {
    if (submitted && thankYouRef.current) {
      gsap.fromTo(thankYouRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 })
    }
  }, [submitted])

  return (
    <div ref={containerRef} className="screen end-screen">
      <h1 className="end-title">You made it!</h1>
      <p className="end-subtitle">Hope you had fun. Will you join us at the party?</p>
      {!submitted ? (
        <RSVPForm onSubmit={handleSubmit} />
      ) : (
        <p ref={thankYouRef} className="thank-you-message">
          {rsvpData?.attending
            ? "Thank you! We'll see you there."
            : "Thanks for letting us know. You'll be missed!"}
        </p>
      )}
    </div>
  )
}
