import { useState } from 'react'

/**
 * Reusable hamburger menu for difficulty, end (RSVP), and other screens.
 * Uses the same styles as the in-game menu (.game-menu-*).
 */
export default function ScreenMenu({ actions = [], title = 'Meniu' }) {
  const [open, setOpen] = useState(false)

  const handleAction = (onClick) => {
    setOpen(false)
    onClick?.()
  }

  return (
    <>
      <button
        type="button"
        className="game-menu-btn"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      {open && (
        <div
          className="game-menu-overlay"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div
            className="game-menu-panel"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h2>{title}</h2>
            {actions.map(({ label, onClick }, i) => (
              <button
                key={i}
                type="button"
                className="game-menu-action"
                onClick={() => handleAction(onClick)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="game-menu-close"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
