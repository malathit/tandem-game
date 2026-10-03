import { useReducer } from 'react'
import type { Language } from '../content/types'
import type { Turn } from '../game/buildTurns'
import { createGame, gameReducer } from '../game/gameReducer'

interface GameProps {
  turns: Turn[]
  languages: Language[]
  onPlayAgain: () => void
}

export function Game({ turns, languages, onPlayAgain }: GameProps) {
  // The third argument runs once, on the first render, to create the initial
  // state. `turns` was already shuffled by the parent, so re-renders here
  // (every click) never reshuffle the sentences.
  const [state, dispatch] = useReducer(gameReducer, turns, createGame)

  if (state.status === 'finished') {
    return (
      <section className="card finished">
        <h2>Round complete</h2>
        <p>{state.turns.length} sentences translated.</p>
        <button type="button" className="primary" onClick={onPlayAgain}>
          Play again
        </button>
      </section>
    )
  }

  const turn = state.turns[state.index]
  const isLastTurn = state.index === state.turns.length - 1
  const learning = languages.find((l) => l.code === turn.learning)?.name ?? turn.learning

  return (
    // data-player lets the CSS give each player their own colour.
    <section className="card" data-player={turn.player}>
      <p className="turn-count">
        Turn {state.index + 1} of {state.turns.length}
      </p>
      <progress value={state.index + 1} max={state.turns.length} aria-hidden="true" />
      <h2>
        Player {turn.player}, translate into {learning}:
      </h2>
      <p className="sentence">{turn.sentence.text}</p>
      {/* The UI only says what happened; the reducer decides what changes. */}
      <button type="button" className="primary" onClick={() => dispatch({ type: 'NEXT_TURN' })}>
        {isLastTurn ? 'Finish round' : 'Next turn'}
      </button>
    </section>
  )
}
