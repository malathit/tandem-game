import { useReducer } from 'react'
import type { Language } from '../content/types'
import type { Turn } from '../game/buildTurns'
import { createGame, gameReducer } from '../game/gameReducer'
import { TurnView } from './TurnView'

interface GameProps {
  turns: Turn[]
  languages: Language[]
  onPlayAgain: () => void
}

/** A round played on one device: it keeps the game state and shows it. */
export function Game({ turns, languages, onPlayAgain }: GameProps) {
  // The third argument runs once, on the first render, to create the initial
  // state. `turns` was already shuffled by the parent, so re-renders here
  // (every click) never reshuffle the sentences.
  const [state, dispatch] = useReducer(gameReducer, turns, createGame)

  return (
    <TurnView
      game={state}
      languages={languages}
      canAct
      // The UI only says what happened; the reducer decides what changes.
      onNext={() => dispatch({ type: 'NEXT_TURN' })}
      onPlayAgain={onPlayAgain}
    />
  )
}
