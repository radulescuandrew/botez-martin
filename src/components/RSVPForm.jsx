import { useState } from 'react'

export default function RSVPForm({ onSubmit }) {
  const [name, setName] = useState('')
  const [attending, setAttending] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || attending === null) return
    onSubmit({ name: name.trim(), attending })
  }

  return (
    <form className="rsvp-form" onSubmit={handleSubmit}>
      <label htmlFor="rsvp-name">Your name</label>
      <input
        id="rsvp-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        required
      />
      <fieldset className="rsvp-attending">
        <legend>Will you come?</legend>
        <label>
          <input
            type="radio"
            name="attending"
            checked={attending === true}
            onChange={() => setAttending(true)}
          />
          I&apos;m coming
        </label>
        <label>
          <input
            type="radio"
            name="attending"
            checked={attending === false}
            onChange={() => setAttending(false)}
          />
          I can&apos;t make it
        </label>
      </fieldset>
      <button type="submit" className="rsvp-submit">
        Submit
      </button>
    </form>
  )
}
