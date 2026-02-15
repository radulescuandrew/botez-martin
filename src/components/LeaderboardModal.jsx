export default function LeaderboardModal({ open, onClose, rows = [], loading = false, error = '' }) {
  if (!open) return null

  return (
    <div className="leaderboard-modal-overlay" onClick={onClose}>
      <div className="leaderboard-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="leaderboard-modal-header">
          <h2 className="leaderboard-modal-title">Leaderboard</h2>
          <button type="button" className="leaderboard-modal-close" onClick={onClose}>Close</button>
        </div>
        {loading && <p className="leaderboard-modal-state">Se incarca...</p>}
        {!loading && error && <p className="leaderboard-modal-state leaderboard-modal-error">{error}</p>}
        {!loading && !error && (
          <>
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jucator</th>
                    <th>Scor</th>
                    <th>Dificultate</th>
                    <th>Incercari</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Nu exista scoruri inca.</td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const raw = row.best_difficulty ?? row.difficulty ?? 'medium'
                      const d = raw === 'easy' || raw === 'nightmare' ? raw : 'medium'
                      return (
                        <tr key={row.id ?? `${row.username}-${idx}`}>
                          <td>{idx + 1}</td>
                          <td>{row.username || '(anonim)'}</td>
                          <td>{row.high_score ?? 0}</td>
                          <td>
                            <span className={`difficulty-badge difficulty-badge-${d}`} title={d} aria-label={d}>
                              {d === 'easy' ? 'E' : d === 'nightmare' ? 'N' : 'M'}
                            </span>
                          </td>
                          <td>{row.total_attempts ?? 0}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="leaderboard-disclaimer">
              Invitatul cu cel mai mare scor in ziua evenimentului, va primii un premiu special.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
