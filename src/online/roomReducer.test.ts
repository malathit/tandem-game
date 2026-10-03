import { describe, expect, it } from 'vitest'
import type { Turn } from '../game/buildTurns'
import { createRoom, roomReducer } from './roomReducer'

const turns: Turn[] = [
  { player: 1, sentence: { id: 'a', text: 'a' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'b' }, learning: 'de' },
]

const joined = roomReducer(createRoom('en'), { type: 'GUEST_HELLO', learning: 'de' })
const playing = roomReducer(joined, { type: 'START_ROUND', topic: 'modal-verbs', turns })

describe('createRoom', () => {
  it('starts with only the host in it', () => {
    expect(createRoom('en')).toEqual({ hostLearning: 'en', guestLearning: null, round: null })
  })
})

describe('GUEST_HELLO', () => {
  it('records the language the guest is learning', () => {
    expect(joined.guestLearning).toBe('de')
  })

  it('ignores a guest who wants to learn the same language as the host', () => {
    const room = createRoom('en')
    expect(roomReducer(room, { type: 'GUEST_HELLO', learning: 'en' })).toBe(room)
  })

  it('ignores a second hello once the guest has chosen', () => {
    expect(roomReducer(joined, { type: 'GUEST_HELLO', learning: 'en' })).toBe(joined)
  })
})

describe('START_ROUND', () => {
  it('starts a round on the first turn', () => {
    expect(playing.round).toEqual({
      topic: 'modal-verbs',
      game: { turns, index: 0, status: 'playing' },
    })
  })

  it('needs a guest first', () => {
    const room = createRoom('en')
    expect(roomReducer(room, { type: 'START_ROUND', topic: 't', turns })).toBe(room)
  })

  it('ignores a round with no turns', () => {
    expect(roomReducer(joined, { type: 'START_ROUND', topic: 't', turns: [] })).toBe(joined)
  })
})

describe('NEXT_TURN', () => {
  it('lets the player whose turn it is move on', () => {
    const next = roomReducer(playing, { type: 'NEXT_TURN', from: 1 })
    expect(next.round?.game.index).toBe(1)
  })

  it("ignores a player moving on during the other player's turn", () => {
    expect(roomReducer(playing, { type: 'NEXT_TURN', from: 2 })).toBe(playing)
  })

  it('finishes the round after the last turn', () => {
    let room = roomReducer(playing, { type: 'NEXT_TURN', from: 1 })
    room = roomReducer(room, { type: 'NEXT_TURN', from: 2 })
    expect(room.round?.game.status).toBe('finished')
  })

  it('ignores moves once the round is finished', () => {
    let room = roomReducer(playing, { type: 'NEXT_TURN', from: 1 })
    room = roomReducer(room, { type: 'NEXT_TURN', from: 2 })
    expect(roomReducer(room, { type: 'NEXT_TURN', from: 1 })).toBe(room)
  })

  it('ignores moves when there is no round', () => {
    expect(roomReducer(joined, { type: 'NEXT_TURN', from: 1 })).toBe(joined)
  })
})

describe('PLAY_AGAIN and CHANGE_TOPIC', () => {
  const fresh: Turn[] = [{ player: 1, sentence: { id: 'z', text: 'z' }, learning: 'en' }, turns[1]]

  it('restarts the same topic with new turns', () => {
    const room = roomReducer(playing, { type: 'PLAY_AGAIN', turns: fresh })
    expect(room.round).toEqual({ topic: 'modal-verbs', game: { turns: fresh, index: 0, status: 'playing' } })
  })

  it('cannot play again before a round exists', () => {
    expect(roomReducer(joined, { type: 'PLAY_AGAIN', turns: fresh })).toBe(joined)
  })

  it('goes back to topic choice and keeps both languages', () => {
    const room = roomReducer(playing, { type: 'CHANGE_TOPIC' })
    expect(room).toEqual({ hostLearning: 'en', guestLearning: 'de', round: null })
  })
})
