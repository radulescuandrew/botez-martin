import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseEnabled, getSupabaseSession } from '../lib/supabase'
import './Admin.css'

export default function Admin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [invitees, setInvitees] = useState([])
  const [rsvpList, setRsvpList] = useState([])
  const [rsvpError, setRsvpError] = useState('')
  const [progressList, setProgressList] = useState([])
  const [progressError, setProgressError] = useState('')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [copyId, setCopyId] = useState(null)
  const [attendanceUpdateError, setAttendanceUpdateError] = useState('')
  const [updatingAttendanceId, setUpdatingAttendanceId] = useState(null)

  const isAdmin = profile?.role === 'admin'

  const loadProfile = useCallback(async (uid) => {
    if (!supabase || !uid) return null
    const { data } = await supabase.from('profiles').select('role').eq('id', uid).single()
    return data
  }, [])

  const loadInvitees = useCallback(async () => {
    if (!supabase || !isAdmin) return
    const { data, error } = await supabase
      .from('invitees')
      .select('id, name, email, joined_at, created_at')
      .order('created_at', { ascending: false })
    if (!error) setInvitees(data ?? [])
  }, [isAdmin])

  const loadProgress = useCallback(async () => {
    if (!supabase || !isAdmin) return
    setProgressError('')
    const { data, error } = await supabase
      .from('user_progress')
      .select('id, attempts, username, intro_seen, difficulty, last_score, high_score, best_score_easy, best_score_medium, best_score_nightmare, updated_at')
      .order('updated_at', { ascending: false })
    if (error) {
      setProgressError(error.message ?? 'Eroare la incarcarea progresului.')
      setProgressList([])
      return
    }
    setProgressList(data ?? [])
  }, [isAdmin])

  const loadRsvps = useCallback(async () => {
    if (!supabase || !isAdmin) return
    setRsvpError('')
    const { data, error } = await supabase
      .from('invite_rsvps')
      .select('id, invitee_id, guest_name, church_attending, party_attending, plus_one, plus_one_count, plus_one_names, dietary_restrictions, dietary_restrictions_note, updated_at, invitees(name)')
      .order('updated_at', { ascending: false })
    if (error) {
      setRsvpError(error.message ?? 'Eroare la incarcarea RSVP.')
      setRsvpList([])
      return
    }
    setRsvpList(data ?? [])
  }, [isAdmin])

  useEffect(() => {
    if (!isSupabaseEnabled() || !supabase) return
    getSupabaseSession().then((session) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    let cancelled = false
    loadProfile(user.id).then((p) => {
      if (!cancelled) {
        setProfile(p)
        setProfileLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user?.id, loadProfile])

  useEffect(() => {
    if (isAdmin) {
      loadInvitees()
      loadRsvps()
      loadProgress()
    }
  }, [isAdmin, loadInvitees, loadRsvps, loadProgress])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    if (!supabase) {
      setLoginError('Supabase nu este configurat.')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError(error.message ?? 'Eroare la autentificare.')
      return
    }
  }

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const handleAddInvitee = async (e) => {
    e.preventDefault()
    setAddError('')
    const name = newName.trim()
    if (!name) {
      setAddError('Introdu un nume.')
      return
    }
    if (!supabase || !isAdmin) return
    const { error } = await supabase.from('invitees').insert({ name })
    if (error) {
      setAddError(error.message ?? 'Eroare la adaugare.')
      return
    }
    setNewName('')
    loadInvitees()
  }

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : '—')
  const fmt = (n) => (n != null && Number.isFinite(n) ? String(n) : '—')
  const difficultyLabel = (v) => {
    if (v === 'easy') return 'Easy'
    if (v === 'medium') return 'Medium'
    if (v === 'nightmare') return 'Nightmare'
    return '—'
  }

  const getInviteLink = (id) => {
    const base = window.location.origin
    return `${base}/invite/${id}`
  }

  const copyLink = (id) => {
    const url = getInviteLink(id)
    navigator.clipboard.writeText(url).then(() => {
      setCopyId(id)
      setTimeout(() => setCopyId(null), 2000)
    })
  }

  const updateAttendance = async (rowId, nextPartyAttending) => {
    if (!supabase || !isAdmin) return
    setAttendanceUpdateError('')
    setUpdatingAttendanceId(rowId)
    const payload = nextPartyAttending
      ? { party_attending: true }
      : { party_attending: false, plus_one: false, plus_one_count: 0, plus_one_names: [] }
    const { error } = await supabase.from('invite_rsvps').update(payload).eq('id', rowId)
    if (error) {
      setAttendanceUpdateError(error.message ?? 'Nu am putut actualiza participarea.')
      setUpdatingAttendanceId(null)
      return
    }
    await loadRsvps()
    setUpdatingAttendanceId(null)
  }

  if (!isSupabaseEnabled()) {
    return (
      <div className="admin-page">
        <div className="admin-panel">
          <p>Supabase nu este configurat. Adauga VITE_SUPABASE_URL si VITE_SUPABASE_ANON_KEY in .env</p>
        </div>
      </div>
    )
  }

  if (user && profileLoading) {
    return (
      <div className="admin-page">
        <div className="admin-panel">
          <p>Se verifica accesul...</p>
        </div>
      </div>
    )
  }

  if (user && !profileLoading && !isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-panel">
          <p className="admin-error">Nu ai drepturi de admin.</p>
          <button type="button" className="admin-btn" onClick={handleLogout}>Deconectare</button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="admin-page">
        <div className="admin-card">
          <h1 className="admin-title">Admin Login</h1>
          <p className="admin-muted">Acces doar pentru utilizatori cu rol admin.</p>
          <form onSubmit={handleLogin} className="admin-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input"
              autoComplete="email"
              required
            />
            <input
              type="password"
              placeholder="Parola"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
              autoComplete="current-password"
              required
            />
            {loginError && <p className="admin-error">{loginError}</p>}
            <button type="submit" className="admin-btn">Autentificare</button>
          </form>
        </div>
      </div>
    )
  }

  const respondedInviteeIds = new Set(rsvpList.map((row) => row.invitee_id).filter(Boolean))
  const respondedInvitees = respondedInviteeIds.size
  const comingInvitees = rsvpList.filter((row) => row.party_attending === true)
  const notComingInvitees = rsvpList.filter((row) => row.party_attending === false)
  const unconfirmedInvitees = Math.max(0, invitees.length - respondedInvitees)
  const comingPeopleCount = comingInvitees.reduce((sum, row) => sum + 1 + Math.max(0, Number(row.plus_one_count) || 0), 0)
  const notComingPeopleCount = notComingInvitees.reduce((sum, row) => sum + 1 + Math.max(0, Number(row.plus_one_count) || 0), 0)

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Admin Dashboard</h1>
            <p className="admin-muted">Invitatii, progres si scoruri intr-un singur loc.</p>
          </div>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={handleLogout}>
            Deconectare
          </button>
        </div>

        <div className="admin-stats">
          <div className="admin-stat-card">
            <p className="admin-stat-label">Invitatii</p>
            <p className="admin-stat-value">{invitees.length}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Vin (cu invitatii)</p>
            <p className="admin-stat-value">{comingPeopleCount}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Nu vin (cu invitatii)</p>
            <p className="admin-stat-value">{notComingPeopleCount}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Neconfirmat</p>
            <p className="admin-stat-value">{unconfirmedInvitees}</p>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="admin-subtitle">Adauga invitat</h2>
          <p className="admin-muted">Genereaza rapid link personalizat pentru fiecare invitat.</p>
          <form onSubmit={handleAddInvitee} className="admin-form admin-form-inline">
            <input
              type="text"
              placeholder="Nume complet"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="admin-input"
            />
            <button type="submit" className="admin-btn">Adauga</button>
          </form>
          {addError && <p className="admin-error">{addError}</p>}
        </div>

        <details className="admin-card admin-collapsible" open>
          <summary className="admin-collapsible-summary">
            <span className="admin-subtitle">Lista invitatii</span>
            <span className="admin-collapsible-meta">{invitees.length}</span>
          </summary>
          <div className="admin-collapsible-content">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nume</th>
                    <th>Link</th>
                    <th>Joined At</th>
                  </tr>
                </thead>
                <tbody>
                  {invitees.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Niciun invitat inca.</td>
                    </tr>
                  ) : (
                    invitees.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.name}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-link-btn"
                            onClick={() => copyLink(inv.id)}
                            title="Copiaza link"
                          >
                            {copyId === inv.id ? 'Copiat' : 'Copiaza link'}
                          </button>
                        </td>
                        <td>{formatDate(inv.joined_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <details className="admin-card admin-collapsible" open>
          <summary className="admin-collapsible-summary">
            <span className="admin-subtitle">Progres si scoruri (jucatori)</span>
            <span className="admin-collapsible-meta">{progressList.length}</span>
          </summary>
          <div className="admin-collapsible-content">
            {progressError && <p className="admin-error">{progressError}</p>}
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-progress">
                <thead>
                  <tr>
                    <th>Nume jucator</th>
                    <th>Incercari</th>
                    <th>Dificultate</th>
                    <th>Ultimul scor</th>
                    <th>Cel mai bun scor</th>
                    <th>Best Easy</th>
                    <th>Best Medium</th>
                    <th>Best Nightmare</th>
                    <th>Actualizat</th>
                  </tr>
                </thead>
                <tbody>
                  {progressList.length === 0 ? (
                    <tr>
                      <td colSpan={9}>Niciun progres inca.</td>
                    </tr>
                  ) : (
                    progressList.map((row) => (
                      <tr key={row.id}>
                        <td>{row.username || '(anonim)'}</td>
                        <td>{fmt(row.attempts)}</td>
                        <td>
                          <span className={`admin-pill admin-pill-${row.difficulty ?? 'none'}`}>
                            {difficultyLabel(row.difficulty)}
                          </span>
                        </td>
                        <td>{fmt(row.last_score)}</td>
                        <td>{fmt(row.high_score)}</td>
                        <td>{fmt(row.best_score_easy)}</td>
                        <td>{fmt(row.best_score_medium)}</td>
                        <td>{fmt(row.best_score_nightmare)}</td>
                        <td>{formatDate(row.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <details className="admin-card admin-collapsible" open>
          <summary className="admin-collapsible-summary">
            <span className="admin-subtitle">Status participare (din RSVP)</span>
            <span className="admin-collapsible-meta">{comingPeopleCount}/{comingPeopleCount + notComingPeopleCount}</span>
          </summary>
          <div className="admin-collapsible-content">
            {rsvpError && <p className="admin-error">{rsvpError}</p>}
            {attendanceUpdateError && <p className="admin-error">{attendanceUpdateError}</p>}
            <div className="admin-status-grid">
              <div className="admin-status-card admin-status-card-coming">
                <h3 className="admin-status-title">Vin</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nume</th>
                        <th>+1</th>
                        <th>Nume +1</th>
                        <th>Restrictii</th>
                        <th>Actiune</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comingInvitees.length === 0 ? (
                        <tr>
                          <td colSpan={5}>Nimeni inca.</td>
                        </tr>
                      ) : (
                        comingInvitees.map((row) => (
                          <tr key={`coming-${row.id}`}>
                            <td>{row.invitees?.name || row.guest_name || '(anonim)'}</td>
                            <td>{row.plus_one ? row.plus_one_count : 0}</td>
                            <td>{Array.isArray(row.plus_one_names) && row.plus_one_names.length > 0 ? row.plus_one_names.join(', ') : '—'}</td>
                            <td>{row.dietary_restrictions ? (row.dietary_restrictions_note || 'Da') : 'Nu'}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-link-btn"
                                onClick={() => updateAttendance(row.id, false)}
                                disabled={updatingAttendanceId === row.id}
                              >
                                {updatingAttendanceId === row.id ? 'Se salveaza...' : 'Muta la Nu vin'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-status-card admin-status-card-not-coming">
                <h3 className="admin-status-title">Nu vin / Neconfirmat</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nume</th>
                        <th>Biserica</th>
                        <th>Actualizat</th>
                        <th>Actiune</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notComingInvitees.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Nimeni inca.</td>
                        </tr>
                      ) : (
                        notComingInvitees.map((row) => (
                          <tr key={`not-coming-${row.id}`}>
                            <td>{row.invitees?.name || row.guest_name || '(anonim)'}</td>
                            <td>{row.church_attending ? 'Da' : 'Nu'}</td>
                            <td>{formatDate(row.updated_at)}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-link-btn"
                                onClick={() => updateAttendance(row.id, true)}
                                disabled={updatingAttendanceId === row.id}
                              >
                                {updatingAttendanceId === row.id ? 'Se salveaza...' : 'Muta la Vin'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
