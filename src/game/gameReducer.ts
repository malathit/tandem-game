import type { Turn } from './buildTurns'

export interface GameState {
  turns: Turn[]
  index: number
  status: 'playing' | 'finished'
}

export type GameAction = { type: 'NEXT_TURN' }

export function createGame(turns: Turn[]): GameState {
  return { turns, index: 0, status: turns.length > 0 ? 'playing' : 'finished' }
}

// A reducer is a pure function: (current state, action) -> next state.
// It never changes `state` itself; it returns a new object instead.
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEXT_TURN': {
      if (state.status === 'finished') {
        return state
      }
      const isLastTurn = state.index === state.turns.length - 1
      return isLastTurn ? { ...state, status: 'finished' } : { ...state, index: state.index + 1 }
    }
  }
}
