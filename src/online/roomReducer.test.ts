import { describe, expect, it } from 'vitest'
import type { Turn } from '../game/buildTurns'
import { createRoom, roomReducer } from './roomReducer'

const turns: Turn[] = [
  { player: 1, sentence: { id: 'a', text: 'a' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'b' }, learning: 'de' },
]

const joined = roomReducer(createRoom('en'), { type: 'GUEST_HELLO', knows: 'de' })
const playing = roomReducer(joined, { type: 'START_ROUND', topic: 'modal-verbs', turns })

describe('createRoom', () => {
  it('starts with only the host in it', () => {
    expect(createRoom('en')).toEqual({ hostKnows: 'en', guestKnows: null, round: null, review: null })
  })
})

describe('a room that already knows its first topic', () => {
  it('starts with that topic\'s sentences on the way, so the joining guest never sees an empty room', () => {
    const room = createRoom('en', 'weather')
    expect(room.review).toEqual({ topic: 'weather', turns: [], busy: true, error: null, confirmed: [false, false] })
    expect(roomReducer(room, { type: 'GUEST_HELLO', knows: 'de' }).review).toEqual(room.review)
  })

  it('starts out as a failed review when the host cannot generate sentences at all', () => {
    expect(createRoom('en', 'weather', false).review).toEqual({
      topic: 'weather',
      turns: [],
      busy: false,
      error: 'unavailable',
      confirmed: [false, false],
    })
  })

  it('lets the real review replace it, and clears it like any other', () => {
    const joinedRoom = roomReducer(createRoom('en', 'weather'), { type: 'GUEST_HELLO', knows: 'de' })
    expect(roomReducer(joinedRoom, { type: 'REVIEW_CLOSED' }).review).toBeNull()
  })
})

describe('GUEST_HELLO', () => {
  it('records the language the guest speaks', () => {
    expect(joined.guestKnows).toBe('de')
  })

  it('ignores a guest who wants to learn the same language as the host', () => {
    const room = createRoom('en')
    expect(roomReducer(room, { type: 'GUEST_HELLO', knows: 'en' })).toBe(room)
  })

  it('ignores a second hello once the guest has chosen', () => {
    expect(roomReducer(joined, { type: 'GUEST_HELLO', knows: 'en' })).toBe(joined)
  })
})

describe('START_ROUND', () => {
  it('starts a round on the first turn', () => {
    expect(playing.round).toEqual({
      topic: 'modal-verbs',
      game: { turns, index: 0, status: 'playing', revealed: false },
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

describe('CHANGE_TOPIC', () => {
  it('goes back to topic choice and keeps both languages', () => {
    const room = roomReducer(playing, { type: 'CHANGE_TOPIC' })
    expect(room).toEqual({ hostKnows: 'en', guestKnows: 'de', round: null, review: null })
  })
})

describe('REVEAL', () => {
  const translated = turns.map((turn) => ({ ...turn, sentence: { ...turn.sentence, translation: `${turn.sentence.text}!` } }))
  const withTranslations = roomReducer(joined, { type: 'START_ROUND', topic: 'weather', turns: translated })
  const revealed = (room: typeof joined) => room.round?.game.revealed

  it('shows the translation when the player whose turn it is asks', () => {
    expect(revealed(roomReducer(withTranslations, { type: 'REVEAL', from: 1 }))).toBe(true)
  })

  it("ignores the other player's request", () => {
    expect(roomReducer(withTranslations, { type: 'REVEAL', from: 2 })).toBe(withTranslations)
  })

  it('ignores a request when there is no round or no translation', () => {
    expect(roomReducer(joined, { type: 'REVEAL', from: 1 })).toBe(joined)
    expect(revealed(roomReducer(playing, { type: 'REVEAL', from: 1 }))).toBe(false)
  })

  it('hides it again when the game moves on', () => {
    const shown = roomReducer(withTranslations, { type: 'REVEAL', from: 1 })
    expect(revealed(roomReducer(shown, { type: 'NEXT_TURN', from: 1 }))).toBe(false)
  })
})

describe('reviewing the sentences', () => {
  const update = { type: 'REVIEW_UPDATED', topic: 'greetings', turns, busy: false, error: null } as const
  const reviewing = roomReducer(joined, update)

  describe('REVIEW_UPDATED', () => {
    it('opens a review where nobody has confirmed yet', () => {
      expect(reviewing.review).toEqual({ topic: 'greetings', turns, busy: false, error: null, confirmed: [false, false] })
    })

    it('needs a guest first, and does nothing once a round is running', () => {
      const alone = createRoom('en')
      expect(roomReducer(alone, update)).toBe(alone)
      expect(roomReducer(playing, update)).toBe(playing)
    })

    it('keeps the state as it is when nothing changed, so confirmations stay', () => {
      const confirmed = roomReducer(reviewing, { type: 'CONFIRM', from: 1 })
      expect(roomReducer(confirmed, update)).toBe(confirmed)
    })

    it('clears both confirmations when the sentences are replaced', () => {
      const confirmed = roomReducer(reviewing, { type: 'CONFIRM', from: 1 })
      const replaced = roomReducer(confirmed, { ...update, turns: [...turns] })
      expect(replaced.review?.confirmed).toEqual([false, false])
    })

    it('clears both confirmations as soon as new sentences are being generated', () => {
      const confirmed = roomReducer(reviewing, { type: 'CONFIRM', from: 2 })
      const busy = roomReducer(confirmed, { ...update, busy: true })
      expect(busy.review).toMatchObject({ busy: true, turns, confirmed: [false, false] })
    })

    it('keeps the old sentences and says what went wrong when generating failed', () => {
      const failed = roomReducer(reviewing, { ...update, error: 'unavailable' })
      expect(failed.review).toMatchObject({ turns, error: 'unavailable', busy: false })
    })
  })

  describe('CONFIRM', () => {
    it('records who confirmed without starting the round', () => {
      const one = roomReducer(reviewing, { type: 'CONFIRM', from: 1 })
      expect(one.review?.confirmed).toEqual([true, false])
      expect(one.round).toBeNull()
      expect(roomReducer(reviewing, { type: 'CONFIRM', from: 2 }).review?.confirmed).toEqual([false, true])
    })

    it('starts the round on the reviewed sentences once both have confirmed, whoever is last', () => {
      for (const order of [[1, 2], [2, 1]] as const) {
        const first = roomReducer(reviewing, { type: 'CONFIRM', from: order[0] })
        const started = roomReducer(first, { type: 'CONFIRM', from: order[1] })
        expect(started.round).toEqual({ topic: 'greetings', game: { turns, index: 0, status: 'playing', revealed: false } })
        expect(started.review).toBeNull()
      }
    })

    it('ignores a second confirmation from the same player', () => {
      const one = roomReducer(reviewing, { type: 'CONFIRM', from: 1 })
      expect(roomReducer(one, { type: 'CONFIRM', from: 1 })).toBe(one)
    })

    it('ignores confirmations while sentences are being generated, when there are none, or when there is no review', () => {
      const busy = roomReducer(reviewing, { ...update, busy: true })
      expect(roomReducer(busy, { type: 'CONFIRM', from: 1 })).toBe(busy)
      const empty = roomReducer(joined, { ...update, turns: [], busy: true })
      expect(roomReducer(empty, { type: 'CONFIRM', from: 1 })).toBe(empty)
      expect(roomReducer(joined, { type: 'CONFIRM', from: 1 })).toBe(joined)
    })

    it('can still be confirmed after a failed regeneration, using the sentences they already had', () => {
      const failed = roomReducer(reviewing, { ...update, error: 'unavailable' })
      expect(roomReducer(failed, { type: 'CONFIRM', from: 1 }).review?.confirmed).toEqual([true, false])
    })
  })

  describe('REVIEW_CLOSED and CHANGE_TOPIC', () => {
    it('both leave the review for everyone', () => {
      expect(roomReducer(reviewing, { type: 'REVIEW_CLOSED' }).review).toBeNull()
      expect(roomReducer(reviewing, { type: 'CHANGE_TOPIC' }).review).toBeNull()
    })

    it('closing when there is no review changes nothing', () => {
      expect(roomReducer(joined, { type: 'REVIEW_CLOSED' })).toBe(joined)
    })
  })

  describe('GUEST_LEFT', () => {
    it("takes back the guest's confirmation but not the host's", () => {
      const guestOnly = roomReducer(reviewing, { type: 'CONFIRM', from: 2 })
      expect(roomReducer(guestOnly, { type: 'GUEST_LEFT' }).review?.confirmed).toEqual([false, false])
      const hostOnly = roomReducer(reviewing, { type: 'CONFIRM', from: 1 })
      expect(roomReducer(hostOnly, { type: 'GUEST_LEFT' })).toBe(hostOnly)
    })

    it('changes nothing when there is no review', () => {
      expect(roomReducer(joined, { type: 'GUEST_LEFT' })).toBe(joined)
    })
  })
})
