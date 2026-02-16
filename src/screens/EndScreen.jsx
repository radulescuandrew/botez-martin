import { useRef, useState, useEffect, useMemo } from 'react'
import { gsap } from 'gsap'
import RSVPForm from '../components/RSVPForm'
import LeaderboardModal from '../components/LeaderboardModal'
import ScreenMenu from '../components/ScreenMenu'
import { supabase, isSupabaseEnabled, ensureSupabaseSession } from '../lib/supabase'
import { fetchLeaderboard } from '../lib/leaderboard'

const INVITE_STORAGE_KEY = 'martins_baptism_invite'

function getStoredInvite() {
  try {
    const raw = localStorage.getItem(INVITE_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.inviteId ? data : null
  } catch {
    return null
  }
}

export default function EndScreen({ onPlayAgain, onBackToMenu }) {
  const containerRef = useRef(null)
  const thankYouRef = useRef(null)
  const [submitted, setSubmitted] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [rsvpData, setRsvpData] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [editingResponse, setEditingResponse] = useState(false)

  const handleSubmit = async (data) => {
    setSubmitError('')
    setSaving(true)
    try {
      if (isSupabaseEnabled() && supabase) {
        const invite = getStoredInvite()
        if (invite?.inviteToken) {
          const { error } = await supabase.rpc('submit_rsvp_by_invite_token', {
            p_token: invite.inviteToken,
            p_church_attending: data.churchAttending,
            p_party_attending: data.partyAttending,
            p_plus_one: data.plusOne,
            p_plus_one_count: data.plusOneCount,
            p_plus_one_names: data.plusOneNames ?? [],
            p_dietary_restrictions: data.dietaryRestrictions,
            p_dietary_restrictions_note: data.dietaryRestrictionsNote ?? '',
          })
          if (error) throw error
        } else {
          const session = await ensureSupabaseSession()
          if (!session?.user?.id) {
            throw new Error('Nu exista sesiune Supabase.')
          }
          const { error } = await supabase.rpc('submit_rsvp', {
            p_invite_id: invite?.inviteId ?? null,
            p_church_attending: data.churchAttending,
            p_party_attending: data.partyAttending,
            p_plus_one: data.plusOne,
            p_plus_one_count: data.plusOneCount,
            p_plus_one_names: data.plusOneNames,
            p_dietary_restrictions: data.dietaryRestrictions,
            p_dietary_restrictions_note: data.dietaryRestrictionsNote,
          })
          if (error) throw error
        }
      }
      setRsvpData(data)
      setSubmitted(true)
      setEditingResponse(false)
    } catch (err) {
      setSubmitError(err?.message ?? 'Nu am putut salva RSVP-ul acum. Incearca din nou.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const loadLeaderboard = async () => {
      setLeaderboardLoading(true)
      setLeaderboardError('')
      try {
        const rows = await fetchLeaderboard(50)
        if (!cancelled) setLeaderboardRows(rows)
      } catch (err) {
        if (!cancelled) {
          setLeaderboardRows([])
          setLeaderboardError(err?.message ?? 'Nu am putut incarca leaderboard-ul.')
        }
      } finally {
        if (!cancelled) setLeaderboardLoading(false)
      }
    }
    loadLeaderboard()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadExistingRsvp = async () => {
      if (!isSupabaseEnabled() || !supabase) {
        if (!cancelled) setCheckingExisting(false)
        return
      }
      try {
        const invite = getStoredInvite()
        if (invite?.inviteToken) {
          const { data: rows, error } = await supabase.rpc('get_rsvp_by_invite_token', {
            p_token: invite.inviteToken,
          })
          if (!cancelled && !error && rows?.length > 0) {
            const row = rows[0]
            setRsvpData({
              churchAttending: row.church_attending,
              partyAttending: row.party_attending,
              plusOne: row.plus_one,
              plusOneCount: row.plus_one_count ?? 0,
              plusOneNames: row.plus_one_names ?? [],
              dietaryRestrictions: row.dietary_restrictions ?? false,
              dietaryRestrictionsNote: row.dietary_restrictions_note ?? '',
            })
            setSubmitted(true)
          }
        } else {
          const session = await ensureSupabaseSession()
          if (!session?.user?.id) {
            if (!cancelled) setCheckingExisting(false)
            return
          }
          const { data, error } = await supabase
            .from('invite_rsvps')
            .select('church_attending, party_attending, plus_one, plus_one_count, plus_one_names, dietary_restrictions, dietary_restrictions_note')
            .eq('user_id', session.user.id)
            .maybeSingle()
          if (error) {
            console.warn('Supabase load RSVP:', error.message)
          }
          if (!cancelled && data) {
            setRsvpData({
              churchAttending: data.church_attending,
              partyAttending: data.party_attending,
              plusOne: data.plus_one,
              plusOneCount: data.plus_one_count,
              plusOneNames: data.plus_one_names ?? [],
              dietaryRestrictions: data.dietary_restrictions,
              dietaryRestrictionsNote: data.dietary_restrictions_note ?? '',
            })
            setSubmitted(true)
          }
        }
      } finally {
        if (!cancelled) setCheckingExisting(false)
      }
    }
    loadExistingRsvp()
    return () => {
      cancelled = true
    }
  }, [])

  const menuActions = useMemo(() => {
    const a = []
    if (onBackToMenu) {
      a.push({ label: 'Back to main menu', onClick: onBackToMenu })
    }
    a.push({ label: 'Leaderboard', onClick: () => setLeaderboardOpen(true) })
    return a
  }, [onBackToMenu])

  useEffect(() => {
    if (submitted && thankYouRef.current) {
      gsap.fromTo(thankYouRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 })
    }
  }, [submitted])

  return (
    <div ref={containerRef} className="screen end-screen">
      {menuActions.length > 0 && <ScreenMenu actions={menuActions} />}
      <div className="end-video-wrap">
        <video
          className="end-video"
          src="/martin.mp4"
          autoPlay
          loop
          muted
          preload="auto"
          playsInline
        />
      </div>
      <div className="end-content">
        <h1 className="end-title">Te asteptam la botez! ✨</h1>
        <p className="end-date">2 Mai</p>
        {((!submitted || editingResponse) && !checkingExisting) && (
          <p className="end-subtitle">Completeaza formularul de mai jos ca sa stim cum ne organizam.</p>
        )}

        <div className="rsvp-places">
          <div className="rsvp-place-card">
            <div className="rsvp-place-header">
              <p className="rsvp-place-title">⛪ Biserica</p>
              <p className="rsvp-place-time">Ora 14:00</p>
            </div>
            <div className="rsvp-place-body">
              <p className="rsvp-place-name">St. Nicholas Church</p>
              <p className="rsvp-place-address">Strada Cuza Voda 77, 030167 Bucuresti</p>
              <div className="rsvp-place-link-row">
                <a
                  className="rsvp-place-link"
                  href="https://maps.app.goo.gl/V3fEeZoMHTUELcAj6"
                  target="_blank"
                  rel="noreferrer"
                >
                  Vezi pe harta
                </a>
              </div>
            </div>
          </div>
          <div className="rsvp-place-card">
            <div className="rsvp-place-header">
              <p className="rsvp-place-title">🎉 Petrecere</p>
              <p className="rsvp-place-time">Ora 16:00</p>
            </div>
            <div className="rsvp-place-body">
              <p className="rsvp-place-name">Pheonix Cernica - Salon By The Pool</p>
              <p className="rsvp-place-address">Strada Strandului 62, Pantelimon, Ilfov</p>
              <div className="rsvp-place-link-row">
                <a
                  className="rsvp-place-link"
                  href="https://maps.app.goo.gl/KCtsLpHr5JqQmXNP8"
                  target="_blank"
                  rel="noreferrer"
                >
                  Vezi pe harta
                </a>
              </div>
            </div>
          </div>
        </div>

        {(!submitted || editingResponse) && !checkingExisting ? (
          <>
            <RSVPForm
              onSubmit={handleSubmit}
              isSubmitting={saving}
              initialData={rsvpData}
              submitLabel={submitted ? 'Actualizeaza raspunsul' : 'Trimite RSVP'}
            />
            {submitted && (
              <button type="button" className="rsvp-submit" onClick={() => setEditingResponse(false)}>
                Renunta
              </button>
            )}
            {submitError && <p className="rsvp-submit-error">{submitError}</p>}
            {saving && <p className="rsvp-saving">Se salveaza RSVP-ul...</p>}
          </>
        ) : checkingExisting ? (
          <p className="rsvp-saving">Se verifica RSVP-ul...</p>
        ) : (
          <>
            <p ref={thankYouRef} className="thank-you-message">
              {rsvpData?.partyAttending || rsvpData?.churchAttending
                ? 'Multumim! Ne bucuram sa fii alaturi de noi. ❤️'
                : 'Multumim pentru raspuns! Te imbratisam cu drag. 💛'}
            </p>
            <div className="rsvp-actions">
              {onPlayAgain && (
                <button type="button" className="rsvp-submit" onClick={onPlayAgain}>
                  Vreau sa ma mai joc
                </button>
              )}
              <button type="button" className="rsvp-submit" onClick={() => setEditingResponse(true)}>
                Editeaza raspunsul
              </button>
              <button type="button" className="rsvp-submit" onClick={() => setLeaderboardOpen(true)}>
                Leaderboard
              </button>
            </div>
          </>
        )}
      </div>
      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        rows={leaderboardRows}
        loading={leaderboardLoading}
        error={leaderboardError}
      />
    </div>
  )
}
