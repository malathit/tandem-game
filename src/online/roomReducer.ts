import type { LanguageCode } from '../content/types'
import type { Turn } from '../game/buildTurns'
import { createGame, gameReducer } from '../game/gameReducer'
import type { GenerationErrorKind } from '../generation/types'
import type { RoomState } from './protocol'

export type RoomEvent =
  | { type: 'GUEST_HELLO'; knows: LanguageCode }
  /** The host's view of the sentences being generated or reviewed. */
  | { type: 'REVIEW_UPDATED'; topic: string; turns: Turn[]; busy: boolean; error: GenerationErrorKind | null }
  | { type: 'REVIEW_CLOSED' }
  /** A player says the sentences they will read are fine. */
  | { type: 'CONFIRM'; from: 1 | 2 }
  | { type: 'GUEST_LEFT' }
  | { type: 'START_ROUND'; topic: string; turns: Turn[] }
  | { type: 'CHANGE_TOPIC' }
  | { type: 'NEXT_TURN'; from: 1 | 2 }
  | { type: 'REVEAL'; from: 1 | 2 }

/**
 * A new room. With `firstTopic`, it starts out with that topic's sentences on the way (or, if `canGenerate` is false,
 * already failed), so the guest's first view after joining says what is happening instead of waiting for a choice
 * the host has already made.
 */
export const createRoom = (hostKnows: LanguageCode, firstTopic?: string, canGenerate = true): RoomState => ({
  hostKnows,
  guestKnows: null,
  review:
    firstTopic === undefined
      ? null
      : {
          topic: firstTopic,
          turns: [],
          busy: canGenerate,
          error: canGenerate ? null : 'unavailable',
          confirmed: [false, false],
        },
  round: null,
})

// The host runs this for its own actions and for messages from the guest, so
// the rules live in one place. Events that break a rule return the state as is.
export function roomReducer(state: RoomState, event: RoomEvent): RoomState {
  switch (event.type) {
    case 'GUEST_HELLO':
      if (state.guestKnows !== null || event.knows === state.hostKnows) return state
      return { ...state, guestKnows: event.knows }

    case 'REVIEW_UPDATED': {
      if (state.guestKnows === null || state.round !== null) return state
      const { review } = state
      const { topic, turns, busy, error } = event
      if (review && review.topic === topic && review.turns === turns && review.busy === busy && review.error === error) {
        return state
      }
      // New sentences, or new ones on the way, have to be checked again by both.
      const same = review && review.topic === topic && review.turns === turns && !busy
      return { ...state, review: { topic, turns, busy, error, confirmed: same ? review.confirmed : [false, false] } }
    }

    case 'REVIEW_CLOSED':
      return state.review === null ? state : { ...state, review: null }

    case 'CONFIRM': {
      const { review } = state
      if (review === null || state.round !== null || review.busy || review.turns.length === 0) return state
      const index = event.from - 1
      if (review.confirmed[index]) return state
      const confirmed: [boolean, boolean] = [review.confirmed[0], review.confirmed[1]]
      confirmed[index] = true
      if (confirmed[0] && confirmed[1]) {
        return roomReducer(state, { type: 'START_ROUND', topic: review.topic, turns: review.turns })
      }
      return { ...state, review: { ...review, confirmed } }
    }

    case 'GUEST_LEFT':
      if (state.review === null || !state.review.confirmed[1]) return state
      return { ...state, review: { ...state.review, confirmed: [state.review.confirmed[0], false] } }

    case 'START_ROUND':
      if (state.guestKnows === null || event.turns.length === 0) return state
      return { ...state, review: null, round: { topic: event.topic, game: createGame(event.turns) } }

    case 'CHANGE_TOPIC':
      return { ...state, review: null, round: null }

    case 'NEXT_TURN':
    case 'REVEAL': {
      const { round } = state
      if (round === null || round.game.status !== 'playing') return state
      // Only the player whose turn it is may move the game on or show the translation.
      if (round.game.turns[round.game.index].player !== event.from) return state
      return { ...state, round: { ...round, game: gameReducer(round.game, { type: event.type }) } }
    }
  }
}
