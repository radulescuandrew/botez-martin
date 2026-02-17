import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { isSupabaseEnabled } from '../lib/supabase'
import { issueInviteSession, setStoredInvite, isValidInviteUuid } from '../lib/inviteAuth'
import './InvitePage.css'

export default function InvitePage() {
  const { inviteId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | redirect | error

  useEffect(() => {
    if (!inviteId) {
      setStatus('error')
      return
    }
    if (!isSupabaseEnabled()) {
      navigate('/', { replace: true })
      return
    }

    let cancelled = false

    async function run() {
      try {
        const uuid = inviteId.trim()
        if (!uuid || !isValidInviteUuid(uuid)) {
          if (!cancelled) setStatus('error')
          return
        }
        const session = await issueInviteSession(uuid)
        if (cancelled) return

        setStoredInvite(session.inviteId, session.inviteeName, session.inviteToken)
        navigate('/', { replace: true, state: { fromInvite: true, inviteId: session.inviteId, inviteeName: session.inviteeName, inviteToken: session.inviteToken } })
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
