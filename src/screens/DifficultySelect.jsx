import { useState, useEffect, useMemo } from 'react'
import TimboBackground from '../components/TimboBackground'
import ScreenMenu from '../components/ScreenMenu'

const KID_SPRITES = [
  '/sprites/boy_sprites_2/Jump%20(2).png',
  '/sprites/boy_sprites_2/Jump%20(3).png',
]

export default function DifficultySelect({ initialDifficulty = 'medium', onSelect, onSkipToDetails, onBackToMenu, scoresByDifficulty = {} }) {
  const [kidFrame, setKidFrame] = useState(0)
  const scoreEasy = scoresByDifficulty.easy ?? null
  const scoreMedium = scoresByDifficulty.medium ?? null
  const scoreNightmare = scoresByDifficulty.nightmare ?? null

  const menuActions = useMemo(() => {
    const a = []
    if (onBackToMenu) {
      a.push({ label: 'Back to main menu', onClick: onBackToMenu })
    }
    if (onSkipToDetails) {
      a.push({ label: 'Nu vreau sa joc, du-ma la detalii', onClick: onSkipToDetails })
    }
    return a
  }, [onBackToMenu, onSkipToDetails])

  useEffect(() => {
    const id = setInterval(() => setKidFrame((f) => (f + 1) % 2), 200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="screen difficulty-screen">
      {menuActions.length > 0 && <ScreenMenu actions={menuActions} />}
      <TimboBackground scrollOffset={0} />
      <section className="difficulty-section difficulty-section-kid" aria-hidden>
        <div className="difficulty-kid">
          <img
            src={KID_SPRITES[kidFrame]}
            alt=""
            className="difficulty-kid-sprite"
            style={{ width: '100px', height: '100px' }}
          />
        </div>
      </section>

      <section className="difficulty-section difficulty-section-title">
        <h1 className="difficulty-title">Alege Dificultatea</h1>
        <p className="difficulty-subtitle">Alege nivelul de dificultate.</p>
        <p className="difficulty-ps">
          P.S: Nivelul si scorul sunt salvate si vor fi folosite pentru public shaming.
        </p>
      </section>

      <section className="difficulty-section difficulty-section-cards">
      <div className="difficulty-grid">
        <button
          type="button"
          className={`difficulty-card easy ${initialDifficulty === 'easy' ? 'active' : ''}`}
          onClick={() => onSelect('easy')}
        >
          <div className="difficulty-card-head">
            <span className="difficulty-name">Easy</span>
            <span className="difficulty-scor">Scor x1</span>
          </div>
          <p>Mi-ar fi rusine sa joc la dificultatea asta.</p>
          {scoreEasy != null && (
            <p className="difficulty-card-your-score">Scorul tau: {scoreEasy}</p>
          )}
        </button>
        <button
          type="button"
          className={`difficulty-card medium ${initialDifficulty === 'medium' ? 'active' : ''}`}
          onClick={() => onSelect('medium')}
        >
          <div className="difficulty-card-head">
            <span className="difficulty-name">Medium</span>
            <span className="difficulty-scor">Scor x2</span>
          </div>
          <p>Ceva mai greu... e acceptabil.</p>
          {scoreMedium != null && (
            <p className="difficulty-card-your-score">Scorul tau: {scoreMedium}</p>
          )}
        </button>
        <button
          type="button"
          className={`difficulty-card nightmare ${initialDifficulty === 'nightmare' ? 'active' : ''}`}
          onClick={() => onSelect('nightmare')}
        >
          <div className="difficulty-card-head">
            <span className="difficulty-name">Nightmare</span>
            <span className="difficulty-scor">Scor x3</span>
          </div>
          <p>Pentru cei puternici!</p>
          {scoreNightmare != null && (
            <p className="difficulty-card-your-score">Scorul tau: {scoreNightmare}</p>
          )}
        </button>
      </div>
      {onSkipToDetails && (
        <button
          type="button"
          className="difficulty-skip-to-details"
          onClick={onSkipToDetails}
        >
          Nu vreau sa joc, du-ma la detalii
        </button>
      )}
      </section>
    </div>
  )
}
