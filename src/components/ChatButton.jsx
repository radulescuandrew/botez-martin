export default function ChatButton({ onClick, unreadCount = 0, ariaLabel = 'Chat' }) {
  return (
    <button
      type="button"
      className="chat-fab"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="chat-fab-icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      {unreadCount > 0 && <span className="chat-fab-badge" aria-hidden />}
    </button>
  )
}
