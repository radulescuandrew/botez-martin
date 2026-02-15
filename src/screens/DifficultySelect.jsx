import { useState, useEffect } from 'react'
import ParallaxBackground from '../components/ParallaxBackground'

const KID_SPRITES = [
  '/sprites/boy_sprites_2/Jump%20(2).png',
  '/sprites/boy_sprites_2/Jump%20(3).png',
]

export default function DifficultySelect({ initialDifficulty = 'medium', onSelect, scoresByDifficulty = {} }) {
  const [kidFrame, setKidFrame] = useState(0)
  const scoreEasy = scoresByDifficulty.easy ?? null
  const scoreMedium = scoresByDifficulty.medium ?? null
  const scoreNightmare = scoresByDifficulty.nightmare ?? null

  useEffect(() => {
    const id = setInterval(() => setKidFrame((f) => (f + 1) % 2), 200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="screen difficulty-screen">
      <ParallaxBackground scrollOffset={0} />
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
          className={`difficulty-card ${initialDifficulty === 'easy' ? 'active' : ''}`}
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
          className={`difficulty-card ${initialDifficulty === 'medium' ? 'active' : ''}`}
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
      </section>
    </div>
  )
}
