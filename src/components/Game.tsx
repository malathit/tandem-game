import { useReducer } from 'react'
import type { Language } from '../content/types'
import type { Turn } from '../game/buildTurns'
import { createGame, gameReducer } from '../game/gameReducer'

interface GameProps {
  turns: Turn[]
  languages: Language[]
}

export function Game({ turns, languages }: GameProps) {
  // The third argument runs once, on the first render, to create the initial
  // state. `turns` was already shuffled by the parent, so re-renders here
  // (every click) never reshuffle the sentences.
  const [state, dispatch] = useReducer(gameReducer, turns, createGame)

  if (state.status === 'finished') {
    return <p>Round complete.</p>
  }

  const turn = state.turns[state.index]
  const isLastTurn = state.index === state.turns.length - 1
  const learning = languages.find((l) => l.code === turn.learning)?.name ?? turn.learning

  return (
    <section>
      <p>
        Turn {state.index + 1} of {state.turns.length}
      </p>
      <h2>
        Player {turn.player}, translate into {learning}:
      </h2>
      <p>{turn.sentence.text}</p>
      {/* The UI only says what happened; the reducer decides what changes. */}
      <button type="button" onClick={() => dispatch({ type: 'NEXT_TURN' })}>
        {isLastTurn ? 'Finish round' : 'Next turn'}
      </button>
    </section>
  )
}
