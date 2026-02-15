import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseEnabled } from '../lib/supabase'
import './InvitePage.css'

const INVITE_STORAGE_KEY = 'martins_baptism_invite'

function setStoredInvite(inviteId, inviteeName, inviteToken) {
  try {
    localStorage.setItem(
      INVITE_STORAGE_KEY,
      JSON.stringify({
        inviteId: inviteId ?? '',
        inviteeName: inviteeName ?? '',
        inviteToken: inviteToken ?? null,
      })
    )
  } catch {
    /* localStorage not available */
  }
}

export default function InvitePage() {
  const { inviteId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | redirect | error

  useEffect(() => {
    if (!inviteId) {
      setStatus('error')
      return
    }
    if (!isSupabaseEnabled() || !supabase) {
      navigate('/', { replace: true })
      return
    }

    let cancelled = false

    async function run() {
      try {
        const uuid = inviteId.trim()
        if (!uuid) {
          if (!cancelled) setStatus('error')
          return
        }

        const { data: issueData, error: issueErr } = await supabase.rpc('issue_invite_token', {
          p_invite_id: uuid,
        })
        if (cancelled || issueErr || !issueData) {
          if (!cancelled) setStatus('error')
          return
        }
        const token = issueData.token ?? ''
        const name = issueData.name ?? ''

        await supabase.rpc('record_invite_join', { p_invite_id: uuid })
        if (cancelled) return

        setStoredInvite(uuid, name, token)
        navigate('/', { replace: true, state: { fromInvite: true, inviteId: uuid, inviteeName: name, inviteToken: token } })
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    run()
    return () => { cancelled = true }
  }, [inviteId, navigate])

  if (status === 'error') {
    return (
      <div className="invite-page">
        <p className="invite-page-message">Link invalid. Mergi la pagina principala.</p>
        <button type="button" className="invite-page-btn" onClick={() => navigate('/', { replace: true })}>
          Mergi
        </button>
      </div>
    )
  }

  return (
    <div className="invite-page">
      <p className="invite-page-message">Se incarca...</p>
    </div>
  )
}
