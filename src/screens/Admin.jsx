import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseEnabled, getSupabaseSession } from '../lib/supabase'
import './Admin.css'

const ADMIN_OPEN_STORAGE_KEY = 'admin-open-sections'
const ADMIN_SHOW_MERGED_KEY = 'admin-show-merged'
const DEFAULT_OPEN_SECTIONS = { invitees: true, completed: true, progress: true, rsvp: true }

function getStoredOpenSections() {
  if (typeof localStorage === 'undefined') return DEFAULT_OPEN_SECTIONS
  try {
    const raw = localStorage.getItem(ADMIN_OPEN_STORAGE_KEY)
    if (!raw) return DEFAULT_OPEN_SECTIONS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_OPEN_SECTIONS, ...parsed }
  } catch {
    return DEFAULT_OPEN_SECTIONS
  }
}

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
  const [deleteError, setDeleteError] = useState('')
  const [deletingInviteeId, setDeletingInviteeId] = useState(null)
  const [openSections, setOpenSections] = useState(getStoredOpenSections)
  const [showMerged, setShowMerged] = useState(() => {
    try {
      return localStorage.getItem(ADMIN_SHOW_MERGED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeTargetRow, setMergeTargetRow] = useState(null)
  const [mergeSourceRowId, setMergeSourceRowId] = useState('')
  const [mergePlusOneName, setMergePlusOneName] = useState('')
  const [mergeError, setMergeError] = useState('')
  const [merging, setMerging] = useState(false)
  const [addVinName, setAddVinName] = useState('')
  const [addVinInviteeId, setAddVinInviteeId] = useState('')
  const [addVinChurch, setAddVinChurch] = useState(true)
  const [addVinError, setAddVinError] = useState('')
  const [addVinSaving, setAddVinSaving] = useState(false)
  const [editingPlusOneRowId, setEditingPlusOneRowId] = useState(null)
  const [editingPlusOneValue, setEditingPlusOneValue] = useState('')
  const [savingPlusOneRowId, setSavingPlusOneRowId] = useState(null)
  const [movingNoAnswerId, setMovingNoAnswerId] = useState(null) // invitee id being moved; value is 'vin' | 'nu_vin'
  const [movingNoAnswerTo, setMovingNoAnswerTo] = useState(null)
  const [mergeSourceType, setMergeSourceType] = useState('row') // 'row' | 'invitee'
  const [mergeSourceInviteeId, setMergeSourceInviteeId] = useState('')

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
    const { data, error } = await supabase.rpc('get_admin_all_progress')
    if (error) {
      setProgressError(error.message ?? 'Eroare la incarcarea progresului.')
      setProgressList([])
      return
    }
    setProgressList(Array.isArray(data) ? data : [])
  }, [isAdmin])

  const loadRsvps = useCallback(async () => {
    if (!supabase || !isAdmin) return
    setRsvpError('')
    const { data, error } = await supabase
      .from('invite_rsvps')
      .select('id, invitee_id, guest_name, church_attending, party_attending, plus_one, plus_one_count, plus_one_names, dietary_restrictions, dietary_restrictions_note, merged_into_rsvp_id, updated_at, invitees(name)')
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

  useEffect(() => {
    if (!mergeModalOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeMergeModal()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mergeModalOpen])

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

  const setSectionOpen = useCallback((key, open) => {
    setOpenSections((prev) => {
      const next = { ...prev, [key]: open }
      try {
        localStorage.setItem(ADMIN_OPEN_STORAGE_KEY, JSON.stringify(next))
      } catch (_) {}
      return next
    })
  }, [])

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

  const handleDeleteInvitee = async (inv) => {
    if (!supabase || !isAdmin) return
    const message = `Stergi pe "${inv.name}" si toate datele asociate (progres, RSVP, link)? Nu poți anula.`
    if (!window.confirm(message)) return
    setDeleteError('')
    setDeletingInviteeId(inv.id)
    const { error } = await supabase.rpc('delete_invitee', { p_invitee_id: inv.id })
    setDeletingInviteeId(null)
    if (error) {
      setDeleteError(error.message ?? 'Eroare la stergere.')
      return
    }
    await loadInvitees()
    await loadRsvps()
    await loadProgress()
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

  const moveNoAnswerTo = async (inviteeId, toVin) => {
    if (!supabase || !isAdmin) return
    const inv = invitees.find((i) => i.id === inviteeId)
    if (!inv) return
    setAttendanceUpdateError('')
    setMovingNoAnswerId(inviteeId)
    setMovingNoAnswerTo(toVin ? 'vin' : 'nu_vin')
    const { error } = await supabase.from('invite_rsvps').insert({
      user_id: null,
      invitee_id: inviteeId,
      guest_name: inv.name,
      church_attending: false,
      party_attending: toVin,
      plus_one: false,
      plus_one_count: 0,
      plus_one_names: [],
      meal_preference: 'normal',
      dietary_restrictions: false,
    })
    setMovingNoAnswerId(null)
    setMovingNoAnswerTo(null)
    if (error) {
      setAttendanceUpdateError(error.message ?? 'Nu am putut muta.')
      return
    }
    await loadRsvps()
  }

  const toggleShowMerged = () => {
    const next = !showMerged
    setShowMerged(next)
    try {
      localStorage.setItem(ADMIN_SHOW_MERGED_KEY, next ? 'true' : 'false')
    } catch (_) {}
  }

  const openMergeModal = (targetRow) => {
    setMergeTargetRow(targetRow)
    setMergeSourceRowId('')
    setMergeSourceType('row')
    setMergeSourceInviteeId('')
    setMergePlusOneName('')
    setMergeError('')
    setMergeModalOpen(true)
  }

  const closeMergeModal = () => {
    setMergeModalOpen(false)
    setMergeTargetRow(null)
    setMergeSourceRowId('')
    setMergeSourceType('row')
    setMergeSourceInviteeId('')
    setMergePlusOneName('')
    setMergeError('')
  }

  const onMergeSourceChange = (value) => {
    if (!value) {
      setMergeSourceRowId('')
      setMergeSourceType('row')
      setMergeSourceInviteeId('')
      setMergePlusOneName('')
      return
    }
    if (value.startsWith('invitee-')) {
      const inviteeId = value.slice(8)
      const inv = noAnswerInvitees.find((i) => i.id === inviteeId)
      setMergeSourceType('invitee')
      setMergeSourceInviteeId(inviteeId)
      setMergeSourceRowId('')
      setMergePlusOneName(inv?.name ?? '')
    } else {
      const rowId = value.startsWith('row-') ? value.slice(4) : value
      const row = comingInvitees.find((r) => r.id === rowId)
      setMergeSourceType('row')
      setMergeSourceRowId(rowId)
      setMergeSourceInviteeId('')
      setMergePlusOneName(row?.invitees?.name || row?.guest_name || '')
    }
  }

  const mergeSourceValue = mergeSourceType === 'invitee' && mergeSourceInviteeId
    ? `invitee-${mergeSourceInviteeId}`
    : mergeSourceRowId
      ? `row-${mergeSourceRowId}`
      : ''

  const handleMergeSubmit = async () => {
    if (!supabase || !isAdmin || !mergeTargetRow) return
    const name = mergePlusOneName.trim()
    if (!name) {
      setMergeError('Introdu numele pentru +1.')
      return
    }
    const targetId = mergeTargetRow.id
    const existingNames = Array.isArray(mergeTargetRow.plus_one_names) ? mergeTargetRow.plus_one_names : []
    const newPlusOneNames = [...existingNames, name]
    const newPlusOneCount = newPlusOneNames.length

    if (mergeSourceType === 'invitee' && mergeSourceInviteeId) {
      const inv = noAnswerInvitees.find((i) => i.id === mergeSourceInviteeId)
      if (!inv) {
        setMergeError('Invitatul nu a fost găsit.')
        return
      }
      setMergeError('')
      setMerging(true)
      const { error: errInsert } = await supabase.from('invite_rsvps').insert({
        user_id: null,
        invitee_id: mergeSourceInviteeId,
        guest_name: inv.name,
        church_attending: false,
        party_attending: true,
        merged_into_rsvp_id: targetId,
        plus_one: false,
        plus_one_count: 0,
        plus_one_names: [],
        meal_preference: 'normal',
        dietary_restrictions: false,
      })
      if (errInsert) {
        setMergeError(errInsert.message ?? 'Eroare la unire.')
        setMerging(false)
        return
      }
      const { error: err2 } = await supabase
        .from('invite_rsvps')
        .update({
          plus_one: true,
          plus_one_count: newPlusOneCount,
          plus_one_names: newPlusOneNames,
        })
        .eq('id', targetId)
      if (err2) {
        setMergeError(err2.message ?? 'Eroare la actualizarea rândului.')
        setMerging(false)
        return
      }
      setMerging(false)
      closeMergeModal()
      await loadRsvps()
      return
    }

    if (!mergeSourceRowId) {
      setMergeError('Alege un rând sau un invitat de unit.')
      return
    }
    setMergeError('')
    setMerging(true)
    const sourceId = mergeSourceRowId
    const { error: err1 } = await supabase
      .from('invite_rsvps')
      .update({ merged_into_rsvp_id: targetId })
      .eq('id', sourceId)
    if (err1) {
      setMergeError(err1.message ?? 'Eroare la unire.')
      setMerging(false)
      return
    }
    const { error: err2 } = await supabase
      .from('invite_rsvps')
      .update({
        plus_one: true,
        plus_one_count: newPlusOneCount,
        plus_one_names: newPlusOneNames,
      })
      .eq('id', targetId)
    if (err2) {
      setMergeError(err2.message ?? 'Eroare la actualizarea rândului.')
      setMerging(false)
      return
    }
    setMerging(false)
    closeMergeModal()
    await loadRsvps()
  }

  const startEditPlusOne = (row) => {
    setEditingPlusOneRowId(row.id)
    setEditingPlusOneValue(Array.isArray(row.plus_one_names) && row.plus_one_names.length > 0 ? row.plus_one_names.join(', ') : '')
  }

  const cancelEditPlusOne = () => {
    setEditingPlusOneRowId(null)
    setEditingPlusOneValue('')
  }

  const savePlusOne = async (rowId) => {
    if (!supabase || !isAdmin) return
    const names = editingPlusOneValue.split(',').map((s) => s.trim()).filter(Boolean)
    setSavingPlusOneRowId(rowId)
    const { error } = await supabase
      .from('invite_rsvps')
      .update({
        plus_one: names.length > 0,
        plus_one_count: names.length,
        plus_one_names: names,
      })
      .eq('id', rowId)
    setSavingPlusOneRowId(null)
    setEditingPlusOneRowId(null)
    setEditingPlusOneValue('')
    if (!error) await loadRsvps()
  }

  const handleAddVin = async (e) => {
    e.preventDefault()
    if (!supabase || !isAdmin) return
    const name = addVinName.trim()
    if (!name) {
      setAddVinError('Introdu numele.')
      return
    }
    setAddVinError('')
    setAddVinSaving(true)
    const { error } = await supabase.from('invite_rsvps').insert({
      user_id: null,
      invitee_id: addVinInviteeId || null,
      guest_name: name,
      church_attending: addVinChurch,
      party_attending: true,
      plus_one: false,
      plus_one_count: 0,
      plus_one_names: [],
      meal_preference: 'normal',
      dietary_restrictions: false,
    })
    setAddVinSaving(false)
    if (error) {
      setAddVinError(error.message ?? 'Eroare la adaugare.')
      return
    }
    setAddVinName('')
    setAddVinInviteeId('')
    setAddVinChurch(true)
    await loadRsvps()
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
  const comingInvitees = rsvpList.filter((row) => row.party_attending === true)
  const comingInviteesVisible = showMerged
    ? comingInvitees
    : comingInvitees.filter((row) => !row.merged_into_rsvp_id)
  const notComingInvitees = rsvpList.filter((row) => row.party_attending === false)
  const noAnswerInvitees = invitees.filter((inv) => !respondedInviteeIds.has(inv.id))
  const unconfirmedInvitees = noAnswerInvitees.length
  const comingPeopleCount = comingInvitees.reduce((sum, row) => sum + 1 + Math.max(0, Number(row.plus_one_count) || 0), 0)
  const notComingPeopleCount = notComingInvitees.reduce((sum, row) => sum + 1 + Math.max(0, Number(row.plus_one_count) || 0), 0)
  const mergeCandidateRows = mergeTargetRow
    ? comingInvitees.filter(
        (row) => row.id !== mergeTargetRow.id && !row.merged_into_rsvp_id
      )
    : []
  const completedList = (progressList || []).filter((r) => r.completed_game)

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

        <details
          className="admin-card admin-collapsible"
          open={openSections.invitees}
          onToggle={(e) => setSectionOpen('invitees', e.target.open)}
        >
          <summary className="admin-collapsible-summary">
            <span className="admin-subtitle">Lista invitatii</span>
            <span className="admin-collapsible-meta">{invitees.length}</span>
          </summary>
          <div className="admin-collapsible-content">
            {deleteError && <p className="admin-error">{deleteError}</p>}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nume</th>
                    <th>Link</th>
                    <th>Joined At</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invitees.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Niciun invitat inca.</td>
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
                        <td>
                          <button
                            type="button"
                            className="admin-delete-btn"
                            onClick={() => handleDeleteInvitee(inv)}
                            disabled={deletingInviteeId === inv.id}
                            title="Sterge invitat si toate datele"
                          >
                            {deletingInviteeId === inv.id ? 'Se sterge…' : 'Sterge'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <details
          className="admin-card admin-collapsible"
          open={openSections.completed}
          onToggle={(e) => setSectionOpen('completed', e.target.open)}
        >
          <summary className="admin-collapsible-summary">
            <span className="admin-subtitle">Istoric joc (cine a terminat jocul)</span>
            <span className="admin-collapsible-meta">{completedList.length}</span>
          </summary>
          <div className="admin-collapsible-content">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nume</th>
                    <th>Sursa</th>
                    <th>Completat la</th>
                  </tr>
                </thead>
                <tbody>
                  {completedList.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Nimeni nu a terminat jocul inca.</td>
                    </tr>
                  ) : (
                    completedList.map((row) => (
                      <tr key={`${row.source}-${row.id}`}>
                        <td>{row.display_name ?? row.username ?? '(anonim)'}</td>
                        <td>{row.source === 'invite' ? 'Invite' : 'Auth'}</td>
                        <td>{formatDate(row.completed_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <details
          className="admin-card admin-collapsible"
          open={openSections.progress}
          onToggle={(e) => setSectionOpen('progress', e.target.open)}
        >
          <summary className="admin-collapsible-summary">
            <span className="admin-subtitle">Progres si scoruri (toti jucatorii)</span>
            <span className="admin-collapsible-meta">{progressList.length}</span>
          </summary>
          <div className="admin-collapsible-content">
            {progressError && <p className="admin-error">{progressError}</p>}
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-progress">
                <thead>
                  <tr>
                    <th>Nume jucator</th>
                    <th>Sursa</th>
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
                      <td colSpan={10}>Niciun progres inca.</td>
                    </tr>
                  ) : (
                    progressList.map((row) => (
                      <tr key={`${row.source}-${row.id}`}>
                        <td>{row.display_name ?? row.username ?? '(anonim)'}</td>
                        <td>{row.source === 'invite' ? 'Invite' : 'Auth'}</td>
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

        <details
          className="admin-card admin-collapsible"
          open={openSections.rsvp}
          onToggle={(e) => setSectionOpen('rsvp', e.target.open)}
        >
          <summary className="admin-collapsible-summary">
            <span className="admin-subtitle">Status participare (din RSVP)</span>
            <span className="admin-collapsible-meta">Vin {comingPeopleCount} · Nu vin {notComingPeopleCount} · Fara raspuns {noAnswerInvitees.length}</span>
          </summary>
          <div className="admin-collapsible-content">
            {rsvpError && <p className="admin-error">{rsvpError}</p>}
            {attendanceUpdateError && <p className="admin-error">{attendanceUpdateError}</p>}
            <div className="admin-status-rows">
              <div className="admin-status-card admin-status-card-coming">
                <div className="admin-status-header">
                  <h3 className="admin-status-title">Vin</h3>
                  <button
                    type="button"
                    className="admin-link-btn admin-show-merged-btn"
                    onClick={toggleShowMerged}
                    title={showMerged ? 'Ascunde rândurile unite' : 'Arată rândurile unite'}
                  >
                    {showMerged ? 'Ascunde unite' : 'Arată unite'}
                  </button>
                </div>
                <form onSubmit={handleAddVin} className="admin-add-vin-form">
                  <div className="admin-add-vin-fields">
                    <input
                      type="text"
                      className="admin-input admin-add-vin-name"
                      placeholder="Nume"
                      value={addVinName}
                      onChange={(e) => setAddVinName(e.target.value)}
                      maxLength={200}
                    />
                    <select
                      className="admin-input admin-add-vin-invitee"
                      value={addVinInviteeId}
                      onChange={(e) => setAddVinInviteeId(e.target.value)}
                      title="Optional: leagă de un invitat"
                    >
                      <option value="">— Fără invitat —</option>
                      {invitees.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name}
                        </option>
                      ))}
                    </select>
                    <label className="admin-add-vin-church">
                      <input
                        type="checkbox"
                        checked={addVinChurch}
                        onChange={(e) => setAddVinChurch(e.target.checked)}
                      />
                      <span>Biserica</span>
                    </label>
                    <button
                      type="submit"
                      className="admin-btn admin-add-vin-btn"
                      disabled={addVinSaving}
                    >
                      {addVinSaving ? 'Se adauga...' : 'Adauga la Vin'}
                    </button>
                  </div>
                  {addVinError && <p className="admin-error">{addVinError}</p>}
                </form>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nume</th>
                        <th title="Biserica">⛪</th>
                        <th title="Petrecere">🎉</th>
                        <th>+1</th>
                        <th>Nume +1</th>
                        <th>Restrictii</th>
                        <th>Actiune</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comingInviteesVisible.length === 0 ? (
                        <tr>
                          <td colSpan={7}>{showMerged ? 'Nimeni inca.' : 'Nimeni inca. (Unitele sunt ascunse.)'}</td>
                        </tr>
                      ) : (
                        comingInviteesVisible.map((row) => (
                          <tr key={`coming-${row.id}`}>
                            <td>{row.invitees?.name || row.guest_name || '(anonim)'}</td>
                            <td title="Biserica">{row.church_attending ? '✅' : '❌'}</td>
                            <td title="Petrecere">{row.party_attending ? '✅' : '❌'}</td>
                            <td>{row.plus_one ? row.plus_one_count : 0}</td>
                            <td className="admin-plus-one-cell">
                              {editingPlusOneRowId === row.id ? (
                                <div className="admin-plus-one-edit">
                                  <input
                                    type="text"
                                    className="admin-input admin-plus-one-input"
                                    value={editingPlusOneValue}
                                    onChange={(e) => setEditingPlusOneValue(e.target.value)}
                                    placeholder="Nume +1 (separate cu virgula)"
                                    autoFocus
                                  />
                                  <div className="admin-plus-one-edit-actions">
                                    <button type="button" className="admin-link-btn" onClick={cancelEditPlusOne}>Anuleaza</button>
                                    <button type="button" className="admin-btn" onClick={() => savePlusOne(row.id)} disabled={savingPlusOneRowId === row.id}>
                                      {savingPlusOneRowId === row.id ? 'Se salveaza...' : 'Salveaza'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span>{Array.isArray(row.plus_one_names) && row.plus_one_names.length > 0 ? row.plus_one_names.join(', ') : '—'}</span>
                                  <button type="button" className="admin-link-btn admin-edit-plus-one-btn" onClick={() => startEditPlusOne(row)} title="Editeaza nume +1">✏️</button>
                                </>
                              )}
                            </td>
                            <td>{row.dietary_restrictions ? (row.dietary_restrictions_note || 'Da') : 'Nu'}</td>
                            <td>
                              <div className="admin-action-buttons">
                                <button
                                  type="button"
                                  className="admin-link-btn"
                                  onClick={() => openMergeModal(row)}
                                  title="Uneste alt rând aici (ex. cuplu care a raspuns de doua ori)"
                                >
                                  Uneste
                                </button>
                                <button
                                  type="button"
                                  className="admin-link-btn"
                                  onClick={() => updateAttendance(row.id, false)}
                                  disabled={updatingAttendanceId === row.id}
                                >
                                  {updatingAttendanceId === row.id ? 'Se salveaza...' : 'Muta la Nu vin'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-status-card admin-status-card-not-coming">
                <h3 className="admin-status-title">Nu vin</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nume</th>
                        <th title="Biserica">⛪</th>
                        <th title="Petrecere">🎉</th>
                        <th>Actualizat</th>
                        <th>Actiune</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notComingInvitees.length === 0 ? (
                        <tr>
                          <td colSpan={5}>Nimeni inca.</td>
                        </tr>
                      ) : (
                        notComingInvitees.map((row) => (
                          <tr key={`not-coming-${row.id}`}>
                            <td>{row.invitees?.name || row.guest_name || '(anonim)'}</td>
                            <td title="Biserica">{row.church_attending ? '✅' : '❌'}</td>
                            <td title="Petrecere">{row.party_attending ? '✅' : '❌'}</td>
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

              <div className="admin-status-card admin-status-card-no-answer">
                <h3 className="admin-status-title">Fara raspuns inca</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nume</th>
                        <th>Link</th>
                        <th>Joined At</th>
                        <th>Actiune</th>
                      </tr>
                    </thead>
                    <tbody>
                      {noAnswerInvitees.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Toți au raspuns.</td>
                        </tr>
                      ) : (
                        noAnswerInvitees.map((inv) => (
                          <tr key={`no-answer-${inv.id}`}>
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
                            <td>
                              <div className="admin-action-buttons">
                                <button
                                  type="button"
                                  className="admin-link-btn"
                                  onClick={() => moveNoAnswerTo(inv.id, true)}
                                  disabled={movingNoAnswerId === inv.id}
                                >
                                  {movingNoAnswerId === inv.id && movingNoAnswerTo === 'vin' ? 'Se salveaza...' : 'Muta la Vin'}
                                </button>
                                <button
                                  type="button"
                                  className="admin-link-btn"
                                  onClick={() => moveNoAnswerTo(inv.id, false)}
                                  disabled={movingNoAnswerId === inv.id}
                                >
                                  {movingNoAnswerId === inv.id && movingNoAnswerTo === 'nu_vin' ? 'Se salveaza...' : 'Muta la Nu vin'}
                                </button>
                              </div>
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

        {mergeModalOpen && mergeTargetRow && (
          <div className="admin-modal-backdrop" onClick={closeMergeModal} role="dialog" aria-modal="true" aria-labelledby="admin-merge-title">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="admin-merge-title" className="admin-modal-title">Uneste rând în &quot;Vin&quot;</h2>
              <p className="admin-modal-desc">
                Alege rândul care va fi ascuns și afișat ca +1 la <strong>{mergeTargetRow.invitees?.name || mergeTargetRow.guest_name || '(anonim)'}</strong>.
              </p>
              <div className="admin-form-group">
                <label htmlFor="admin-merge-source">Rând sau invitat de unit (va fi ascuns ca +1)</label>
                <select
                  id="admin-merge-source"
                  className="admin-input"
                  value={mergeSourceValue}
                  onChange={(e) => onMergeSourceChange(e.target.value)}
                >
                  <option value="">— Alege —</option>
                  {mergeCandidateRows.length > 0 && (
                    <optgroup label="Vin">
                      {mergeCandidateRows.map((row) => (
                        <option key={`row-${row.id}`} value={`row-${row.id}`}>
                          {row.invitees?.name || row.guest_name || '(anonim)'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {noAnswerInvitees.length > 0 && (
                    <optgroup label="Fara raspuns">
                      {noAnswerInvitees.map((inv) => (
                        <option key={`invitee-${inv.id}`} value={`invitee-${inv.id}`}>
                          {inv.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div className="admin-form-group">
                <label htmlFor="admin-merge-plus-one">Nume +1 (editează dacă e cazul)</label>
                <input
                  id="admin-merge-plus-one"
                  type="text"
                  className="admin-input"
                  value={mergePlusOneName}
                  onChange={(e) => setMergePlusOneName(e.target.value)}
                  placeholder="Numele afișat ca +1"
                />
              </div>
              {mergeError && <p className="admin-error">{mergeError}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeMergeModal}>
                  Anuleaza
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={handleMergeSubmit}
                  disabled={!(mergeSourceRowId || (mergeSourceType === 'invitee' && mergeSourceInviteeId)) || merging}
                >
                  {merging ? 'Se uneste...' : 'Uneste'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
