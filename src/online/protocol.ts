import { isLanguageCode, type LanguageCode } from '../content/types'
import type { Turn } from '../game/buildTurns'
import type { GameState } from '../game/gameReducer'

/** Everything both devices need to show the same screen. The host owns it. */
export interface RoomState {
  hostLearning: LanguageCode
  /** null until the guest has chosen their language. */
  guestLearning: LanguageCode | null
  /** null while the host is choosing a topic. */
  round: { topic: string; game: GameState } | null
}

export type HostMessage = { type: 'state'; state: RoomState }

export type GuestMessage = { type: 'hello'; learning: LanguageCode } | { type: 'next-turn' }

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
  return {
    player: raw.player,
    sentence: { id: sentence.id, text: sentence.text },
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
  const { index, status } = raw
  if (status !== 'playing' && status !== 'finished') return null
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null
  if (index >= Math.max(turns.length, 1)) return null
  return { turns, index, status }
}

function parseRoomState(raw: unknown): RoomState | null {
  if (!isRecord(raw) || !isLanguageCode(raw.hostLearning)) return null
  const { guestLearning, round } = raw
  if (guestLearning !== null && !isLanguageCode(guestLearning)) return null
  if (round === null) {
    return { hostLearning: raw.hostLearning, guestLearning, round: null }
  }
  if (!isRecord(round) || !isText(round.topic)) return null
  const game = parseGame(round.game)
  return game
    ? { hostLearning: raw.hostLearning, guestLearning, round: { topic: round.topic, game } }
    : null
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  if (!isRecord(raw) || raw.type !== 'state') return null
  const state = parseRoomState(raw.state)
  return state ? { type: 'state', state } : null
}

export function parseGuestMessage(raw: unknown): GuestMessage | null {
  if (!isRecord(raw)) return null
  if (raw.type === 'next-turn') return { type: 'next-turn' }
  if (raw.type === 'hello' && isLanguageCode(raw.learning)) {
    return { type: 'hello', learning: raw.learning }
  }
  return null
}
