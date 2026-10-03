import { isLanguageCode, type LanguageCode } from '../content/types'
import type { Turn } from '../game/buildTurns'
import type { GameState } from '../game/gameReducer'
import { GENERATION_ERROR_KINDS, type GenerationErrorKind } from '../generation/types'

/** The sentences the players are checking before a round, shown to both devices. */
export interface ReviewState {
  /** A preset topic's id or the text the host typed. */
  topic: string
  turns: Turn[]
  /** The host is waiting for the AI. */
  busy: boolean
  error: GenerationErrorKind | null
  /** Whether Player 1 and Player 2 have said their own sentences are fine. */
  confirmed: readonly [boolean, boolean]
}

/** Everything both devices need to show the same screen. The host owns it. */
export interface RoomState {
  hostKnows: LanguageCode
  /** null until the guest has chosen their language. */
  guestKnows: LanguageCode | null
  /** The sentences being checked; null unless the host has chosen a topic and no round is running. */
  review: ReviewState | null
  /** null while the host is choosing a topic or the players are reviewing. */
  round: { topic: string; game: GameState } | null
}

export type HostMessage = { type: 'state'; state: RoomState }

export type GuestMessage =
  | { type: 'hello'; knows: LanguageCode }
  | { type: 'confirm' }
  | { type: 'regenerate' }
  | { type: 'next-turn' }
  | { type: 'reveal' }

// Messages come from another device, so nothing in them is trusted: each parser
// checks the shape and size of the data and returns null for anything else.

const MAX_TEXT_LENGTH = 300
const MAX_TURNS = 20

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= MAX_TEXT_LENGTH

function parseTurn(raw: unknown): Turn | null {
  if (!isRecord(raw) || (raw.player !== 1 && raw.player !== 2) || !isLanguageCode(raw.learning)) {
    return null
  }
  const { sentence } = raw
  if (!isRecord(sentence) || !isText(sentence.id) || !isText(sentence.text)) {
    return null
  }
  // The translation is optional, but if it is there it has to be real text.
  if (sentence.translation !== undefined && !isText(sentence.translation)) return null
  return {
    player: raw.player,
    sentence: {
      id: sentence.id,
      text: sentence.text,
      ...(sentence.translation !== undefined && { translation: sentence.translation }),
    },
    learning: raw.learning,
  }
}

function parseGame(raw: unknown): GameState | null {
  if (!isRecord(raw) || !Array.isArray(raw.turns) || raw.turns.length > MAX_TURNS) {
    return null
  }
  const turns: Turn[] = []
  for (const item of raw.turns) {
    const turn = parseTurn(item)
    if (!turn) return null
    turns.push(turn)
  }
  const { index, status, revealed } = raw
  if (status !== 'playing' && status !== 'finished') return null
  if (typeof revealed !== 'boolean') return null
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null
  if (index >= Math.max(turns.length, 1)) return null
  return { turns, index, status, revealed }
}

function parseReview(raw: unknown): ReviewState | null {
  if (!isRecord(raw) || !isText(raw.topic) || !Array.isArray(raw.turns) || raw.turns.length > MAX_TURNS) {
    return null
  }
  const turns: Turn[] = []
  for (const item of raw.turns) {
    const turn = parseTurn(item)
    if (!turn) return null
    turns.push(turn)
  }
  const { busy, error, confirmed } = raw
  if (typeof busy !== 'boolean') return null
  if (error !== null && !GENERATION_ERROR_KINDS.some((kind) => kind === error)) return null
  if (!Array.isArray(confirmed) || confirmed.length !== 2 || confirmed.some((flag) => typeof flag !== 'boolean')) {
    return null
  }
  return {
    topic: raw.topic,
    turns,
    busy,
    error: error as GenerationErrorKind | null,
    confirmed: [confirmed[0], confirmed[1]],
  }
}

function parseRoomState(raw: unknown): RoomState | null {
  if (!isRecord(raw) || !isLanguageCode(raw.hostKnows)) return null
  const { guestKnows, round } = raw
  if (guestKnows !== null && !isLanguageCode(guestKnows)) return null
  // A host that has not been updated yet sends no review, which means there is none.
  const review = raw.review === undefined || raw.review === null ? null : parseReview(raw.review)
  if (raw.review !== undefined && raw.review !== null && review === null) return null
  const common = { hostKnows: raw.hostKnows, guestKnows, review }
  if (round === null) return { ...common, round: null }
  if (!isRecord(round) || !isText(round.topic)) return null
  const game = parseGame(round.game)
  return game ? { ...common, round: { topic: round.topic, game } } : null
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  if (!isRecord(raw) || raw.type !== 'state') return null
  const state = parseRoomState(raw.state)
  return state ? { type: 'state', state } : null
}

export function parseGuestMessage(raw: unknown): GuestMessage | null {
  if (!isRecord(raw)) return null
  if (raw.type === 'next-turn') return { type: 'next-turn' }
  if (raw.type === 'reveal') return { type: 'reveal' }
  if (raw.type === 'confirm') return { type: 'confirm' }
  if (raw.type === 'regenerate') return { type: 'regenerate' }
  if (raw.type === 'hello' && isLanguageCode(raw.knows)) {
    return { type: 'hello', knows: raw.knows }
  }
  return null
}
