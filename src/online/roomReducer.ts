import type { LanguageCode } from '../content/types'
import type { Turn } from '../game/buildTurns'
import { createGame, gameReducer } from '../game/gameReducer'
import type { RoomState } from './protocol'

export type RoomEvent =
  | { type: 'GUEST_HELLO'; learning: LanguageCode }
  | { type: 'START_ROUND'; topic: string; turns: Turn[] }
  | { type: 'CHANGE_TOPIC' }
  | { type: 'NEXT_TURN'; from: 1 | 2 }

export const createRoom = (hostLearning: LanguageCode): RoomState => ({
  hostLearning,
  guestLearning: null,
  round: null,
})

// The host runs this for its own actions and for messages from the guest, so
// the rules live in one place. Events that break a rule return the state as is.
export function roomReducer(state: RoomState, event: RoomEvent): RoomState {
  switch (event.type) {
    case 'GUEST_HELLO':
      if (state.guestLearning !== null || event.learning === state.hostLearning) return state
      return { ...state, guestLearning: event.learning }

    case 'START_ROUND':
      if (state.guestLearning === null || event.turns.length === 0) return state
      return { ...state, round: { topic: event.topic, game: createGame(event.turns) } }

    case 'CHANGE_TOPIC':
      return { ...state, round: null }

    case 'NEXT_TURN': {
      const { round } = state
      if (round === null || round.game.status !== 'playing') return state
      // Only the player whose turn it is may move the game on.
      if (round.game.turns[round.game.index].player !== event.from) return state
      return { ...state, round: { ...round, game: gameReducer(round.game, { type: 'NEXT_TURN' }) } }
    }
  }
}
