import { useEffect, useState } from 'react'

export default function RSVPForm({ onSubmit, isSubmitting = false, initialData = null, submitLabel = 'Trimite RSVP' }) {
  const [churchAttending, setChurchAttending] = useState(null)
  const [partyAttending, setPartyAttending] = useState(null)
  const [plusOne, setPlusOne] = useState(false)
  const [plusOneCount, setPlusOneCount] = useState(1)
  const [plusOneNames, setPlusOneNames] = useState([''])
  const [hasDietaryRestrictions, setHasDietaryRestrictions] = useState(false)
  const [dietaryRestrictionsNote, setDietaryRestrictionsNote] = useState('')

  useEffect(() => {
    if (!initialData) return
    setChurchAttending(typeof initialData.churchAttending === 'boolean' ? initialData.churchAttending : null)
    setPartyAttending(typeof initialData.partyAttending === 'boolean' ? initialData.partyAttending : null)
    setPlusOne(Boolean(initialData.plusOne))
    const count = Math.max(1, Number(initialData.plusOneCount) || 1)
    setPlusOneCount(count)
    const raw = Array.isArray(initialData.plusOneNames) ? initialData.plusOneNames : []
    const names = raw.length >= count ? raw.slice(0, count) : [...raw, ...Array.from({ length: count - raw.length }, () => '')]
    setPlusOneNames(names.length > 0 ? names : [''])
    setHasDietaryRestrictions(Boolean(initialData.dietaryRestrictions))
    setDietaryRestrictionsNote(initialData.dietaryRestrictionsNote ?? '')
  }, [initialData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (churchAttending === null || partyAttending === null) return
    if (partyAttending && plusOne) {
      const anyMissingName = plusOneNames.some((n) => !String(n).trim())
      if (anyMissingName) return
    }
    if (hasDietaryRestrictions && !dietaryRestrictionsNote.trim()) return
    await onSubmit({
      churchAttending,
      partyAttending,
      plusOne: partyAttending ? plusOne : false,
      plusOneCount: partyAttending && plusOne ? plusOneCount : 0,
      plusOneNames: partyAttending && plusOne ? plusOneNames.map((n) => n.trim()) : [],
      dietaryRestrictions: hasDietaryRestrictions,
      dietaryRestrictionsNote: hasDietaryRestrictions ? dietaryRestrictionsNote.trim() : '',
    })
  }

  return (
    <form className="rsvp-form" onSubmit={handleSubmit}>
      <fieldset className="rsvp-attending">
        <legend>1. Vii la biserica?</legend>
        <label>
          <input
            type="radio"
            name="church-attending"
            checked={churchAttending === true}
            onChange={() => setChurchAttending(true)}
            disabled={isSubmitting}
            required
          />
          Da
        </label>
        <label>
          <input
            type="radio"
            name="church-attending"
            checked={churchAttending === false}
            onChange={() => setChurchAttending(false)}
            disabled={isSubmitting}
          />
          Nu
        </label>
      </fieldset>

      <fieldset className="rsvp-attending">
        <legend>2. Vii la petrecere?</legend>
        <label>
          <input
            type="radio"
            name="party-attending"
            checked={partyAttending === true}
            onChange={() => setPartyAttending(true)}
            disabled={isSubmitting}
            required
          />
          Da
        </label>
          <label>
            <input
              type="radio"
              name="party-attending"
              checked={partyAttending === false}
              onChange={() => {
                setPartyAttending(false)
                setPlusOne(false)
                setPlusOneNames([''])
                setPlusOneCount(1)
              }}
              disabled={isSubmitting}
            />
            Nu
          </label>
      </fieldset>

      {partyAttending && (
        <fieldset className="rsvp-attending">
          <legend>2.1. Mai vii cu cineva?</legend>
          <label>
            <input
              type="radio"
              name="plus-one"
              checked={plusOne === true}
              onChange={() => {
                setPlusOne(true)
                setPlusOneNames((prev) => {
                  const next = prev.slice(0, plusOneCount)
                  while (next.length < plusOneCount) next.push('')
                  return next
                })
              }}
              disabled={isSubmitting}
            />
            Da
          </label>
          <label>
            <input
              type="radio"
              name="plus-one"
              checked={plusOne === false}
              onChange={() => {
                setPlusOne(false)
                setPlusOneNames([''])
              }}
              disabled={isSubmitting}
            />
            Nu
          </label>

          {plusOne && (
            <div className="rsvp-plusone-box">
              <p className="rsvp-plusone-label">Cate persoane aduci (+1)?</p>
              <div className="rsvp-stepper" role="group" aria-label="Numar persoane extra">
                <button
                  type="button"
                  className="rsvp-stepper-btn"
                  onClick={() => {
                    const nextCount = Math.max(1, plusOneCount - 1)
                    setPlusOneCount(nextCount)
                    setPlusOneNames((prev) => prev.slice(0, nextCount))
                  }}
                  disabled={isSubmitting}
                >
                  -
                </button>
                <span className="rsvp-stepper-value">{plusOneCount}</span>
                <button
                  type="button"
                  className="rsvp-stepper-btn"
                  onClick={() => {
                    setPlusOneCount((v) => Math.min(10, v + 1))
                    setPlusOneNames((prev) => [...prev, ''])
                  }}
                  disabled={isSubmitting}
                >
                  +
                </button>
              </div>
              <div className="rsvp-plusone-list">
                {Array.from({ length: plusOneCount }).map((_, idx) => (
                  <div key={`plus-one-${idx}`} className="rsvp-plusone-item">
                    <label htmlFor={`plus-one-name-${idx}`}>Nume complet +{idx + 1}</label>
                    <input
                      id={`plus-one-name-${idx}`}
                      type="text"
                      value={plusOneNames[idx] ?? ''}
                      onChange={(e) => {
                        const next = [...plusOneNames]
                        next[idx] = e.target.value
                        setPlusOneNames(next)
                      }}
                      placeholder={`Ex: Invitat ${idx + 1}`}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="rsvp-attending">
        <legend>3. Restrictii alimentare?</legend>
        <label>
          <input
            type="radio"
            name="dietary-restrictions"
            checked={hasDietaryRestrictions === true}
            onChange={() => setHasDietaryRestrictions(true)}
            disabled={isSubmitting}
            required
          />
          Da
        </label>
        <label>
          <input
            type="radio"
            name="dietary-restrictions"
            checked={hasDietaryRestrictions === false}
            onChange={() => {
              setHasDietaryRestrictions(false)
              setDietaryRestrictionsNote('')
            }}
            disabled={isSubmitting}
          />
          Nu
        </label>
        {hasDietaryRestrictions && (
          <div className="rsvp-plusone-item">
            <label htmlFor="dietary-note">Te rugam sa detaliezi</label>
            <input
              id="dietary-note"
              type="text"
              value={dietaryRestrictionsNote}
              onChange={(e) => setDietaryRestrictionsNote(e.target.value)}
              placeholder="Ex: fara lactoza, fara gluten, alergii..."
              disabled={isSubmitting}
              required
            />
          </div>
        )}
      </fieldset>

      <button type="submit" className="rsvp-submit" disabled={isSubmitting}>
        {isSubmitting ? 'Se trimite...' : submitLabel}
      </button>
    </form>
  )
}
