import type { Language } from '../content/types'
import type { GameState } from '../game/gameReducer'

interface TurnViewProps {
  game: GameState
  languages: Language[]
  /** Whether this device's player may move the game on. */
  canAct: boolean
  onNext: () => void
  /** Shows the translation to both players. */
  onReveal: () => void
  /** Only given on a device that may start another round. */
  onPlayAgain?: () => void
}

/** Shows a round from the host's copy of the game; it owns no state itself. */
export function TurnView({ game, languages, canAct, onNext, onReveal, onPlayAgain }: TurnViewProps) {
  if (game.status === 'finished') {
    return (
      <section className="card finished">
        <h2>Round complete</h2>
        <p>{game.turns.length} sentences translated.</p>
        {onPlayAgain ? (
          <button type="button" className="primary" onClick={onPlayAgain}>
            Play again
          </button>
        ) : (
          <p role="status">Waiting for the host to start another round.</p>
        )}
      </section>
    )
  }

  const turn = game.turns[game.index]
  const isLastTurn = game.index === game.turns.length - 1
    const learning = languages.find((l) => l.code === turn.learning)?.name ?? turn.learning

  return (
    // data-player lets the CSS give each player their own colour.
    <section className="card" data-player={turn.player}>
      <p className="turn-count">
        Turn {game.index + 1} of {game.turns.length}
      </p>
      <progress value={game.index + 1} max={game.turns.length} aria-hidden="true" />
      <h2>
        {canAct ? 'Your turn' : "Your partner's turn"}: translate into {learning}
      </h2>
      <p className="sentence">{turn.sentence.text}</p>
      {game.revealed && (
        <p className="translation">
          <span className="preview-who">Translation</span>
          {turn.sentence.translation}
        </p>
      )}
      {canAct ? (
        // The speaker may show the translation first, or move on without showing it.
        <>
          {!game.revealed && (
            <button type="button" className="primary" onClick={onReveal}>
              Show translation
            </button>
          )}
          <button type="button" className={game.revealed ? 'primary' : undefined} onClick={onNext}>
            {isLastTurn ? 'Finish round' : 'Next turn'}
          </button>
        </>
      ) : (
        <p role="status">Waiting for your partner to finish their turn…</p>
      )}
    </section>
  )
}
