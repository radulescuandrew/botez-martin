import { useRef, useEffect } from 'react'

function formatMessageTime(createdAt) {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function ChatModal({
  open,
  onClose,
  currentUsername = '',
  messages = [],
  loading = false,
  error = '',
  onSendMessage,
  onMarkAsRead,
  sending = false,
}) {
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [open, messages])

  const handleClose = () => {
    onMarkAsRead?.()
    onClose?.()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const input = inputRef.current
    const body = (input?.value ?? '').trim()
    if (!body || sending || !onSendMessage) return
    onSendMessage(body)
    if (input) input.value = ''
  }

  if (!open) return null

  return (
    <div className="chat-modal-overlay" onClick={handleClose}>
      <div className="chat-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <h2 className="chat-modal-title">Chat</h2>
          <button type="button" className="chat-modal-close" onClick={handleClose}>
            Close
          </button>
        </div>
        {loading && messages.length === 0 && (
          <p className="chat-modal-state">Se incarca...</p>
        )}
        {!loading && error && (
          <p className="chat-modal-state chat-modal-error">{error}</p>
        )}
        {(!loading || messages.length > 0) && !error && (
          <>
            <div ref={listRef} className="chat-message-list">
              {messages.length === 0 ? (
                <p className="chat-message-empty">Niciun mesaj inca. Spune ceva!</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="chat-message">
                    <div className="chat-message-meta">
                      <span className="chat-message-author">{msg.author_name || '(anonim)'}</span>
                      <span className="chat-message-time">{formatMessageTime(msg.created_at)}</span>
                    </div>
                    <p className="chat-message-body">{msg.body}</p>
                  </div>
                ))
              )}
            </div>
            <form className="chat-input-wrap" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                className="chat-input"
                placeholder="Scrie un mesaj..."
                maxLength={2000}
                disabled={sending}
                aria-label="Mesaj"
              />
              <button type="submit" className="chat-send-btn" disabled={sending} aria-label="Trimite">
                Trimite
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
