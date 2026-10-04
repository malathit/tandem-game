import { describe, expect, it } from 'vitest'
import { parseGuestMessage, parseHostMessage, type RoomState } from './protocol'

const roomState: RoomState = {
  hostKnows: 'en',
  guestKnows: 'de',
  review: null,
  round: {
    topic: 'modal-verbs',
    game: {
      turns: [
        { player: 1, sentence: { id: 'a', text: 'Ich kann schwimmen.', translation: 'I can swim.' }, learning: 'en' },
        { player: 2, sentence: { id: 'b', text: 'I can swim.', translation: 'Ich kann schwimmen.' }, learning: 'de' },
      ],
      index: 1,
      status: 'playing',
      revealed: false,
    },
  },
}

const withRound = (change: Record<string, unknown>) => ({
  ...roomState,
  round: { ...roomState.round, game: { ...roomState.round!.game, ...change } },
})

describe('parseGuestMessage', () => {
  it('accepts reveal', () => {
    expect(parseGuestMessage({ type: 'reveal', extra: 'x' })).toEqual({ type: 'reveal' })
  })

  it('accepts confirm and regenerate', () => {
    expect(parseGuestMessage({ type: 'confirm', extra: 'x' })).toEqual({ type: 'confirm' })
    expect(parseGuestMessage({ type: 'regenerate', extra: 'x' })).toEqual({ type: 'regenerate' })
  })

  it('accepts next-turn and drops unexpected fields', () => {
    expect(parseGuestMessage({ type: 'next-turn', extra: 'x' })).toEqual({ type: 'next-turn' })
  })

  it.each([
    // The guest no longer says which language it speaks: the host decides.
    [{ type: 'hello', knows: 'de' }],
    [{ type: 'explode' }],
    [{}],
    ['next-turn'],
    [null],
    [undefined],
    [42],
    [[]],
  ])('rejects %j', (raw) => {
    expect(parseGuestMessage(raw)).toBeNull()
  })
})

describe('parseHostMessage', () => {
  it('accepts a full room state', () => {
    expect(parseHostMessage({ type: 'state', state: roomState })).toEqual({
      type: 'state',
      state: roomState,
    })
  })

  it('keeps a translation and the reveal flag', () => {
    const state = withRound({
      turns: [{ player: 1, sentence: { id: 'a', text: 'Ich kann schwimmen.', translation: 'I can swim.' }, learning: 'en' }],
      index: 0,
      revealed: true,
    })
    expect(parseHostMessage({ type: 'state', state })).toEqual({ type: 'state', state })
  })

  it('drops unexpected fields from a sentence', () => {
    const turn = { player: 1, sentence: { id: 'a', text: 'x', translation: 'y', answer: 'z' }, learning: 'en' }
    const parsed = parseHostMessage({ type: 'state', state: withRound({ turns: [turn], index: 0 }) })
    expect(parsed?.state.round?.game.turns[0].sentence).toEqual({ id: 'a', text: 'x', translation: 'y' })
  })

  it('accepts a lobby state with no guest and no round', () => {
    const lobby = { hostKnows: 'en', guestKnows: null, round: null, review: null }
    expect(parseHostMessage({ type: 'state', state: lobby })).toEqual({ type: 'state', state: lobby })
  })

  it('accepts a state from a host that does not know about reviews yet, as having none', () => {
    const old = { hostKnows: 'en', guestKnows: 'de', round: null }
    expect(parseHostMessage({ type: 'state', state: old })?.state.review).toBeNull()
  })

  describe('a review', () => {
    const turn = { player: 1, sentence: { id: 'a', text: 'Ich kann schwimmen.', translation: 'I can swim.' }, learning: 'en' }
    const review = { topic: 'greetings', turns: [turn], busy: false, error: null, confirmed: [true, false] }
    const reviewing = (change: Record<string, unknown>) => ({ ...roomState, review: { ...review, ...change } })

    it('is accepted with who has confirmed and any error', () => {
      expect(parseHostMessage({ type: 'state', state: reviewing({ error: 'limit-reached', busy: true }) })).toEqual({
        type: 'state',
        state: reviewing({ error: 'limit-reached', busy: true }),
      })
    })

    it('drops unexpected fields from it', () => {
      const parsed = parseHostMessage({ type: 'state', state: reviewing({ secret: 'x' }) })
      expect(parsed?.state.review).toEqual(review)
    })

    it.each([
      ['a review that is not an object', { ...roomState, review: 'yes' }],
      ['no topic', reviewing({ topic: '' })],
      ['a very long topic', reviewing({ topic: 'x'.repeat(301) })],
      ['turns that are not a list', reviewing({ turns: 'x' })],
      ['too many turns', reviewing({ turns: Array.from({ length: 21 }, () => turn) })],
      ['a bad turn', reviewing({ turns: [{ ...turn, player: 3 }] })],
      ['a busy flag that is not a boolean', reviewing({ busy: 'yes' })],
      ['an error that does not exist', reviewing({ error: 'boom' })],
      ['a missing error', reviewing({ error: undefined })],
      ['confirmations that are not two booleans', reviewing({ confirmed: [true] })],
      ['confirmations that are not booleans', reviewing({ confirmed: ['yes', 'no'] })],
    ])('rejects %s', (_name, state) => {
      expect(parseHostMessage({ type: 'state', state })).toBeNull()
    })
  })

  it.each([
    ['unknown host language', { ...roomState, hostKnows: 'xx' }],
    ['unknown guest language', { ...roomState, guestKnows: 'xx' }],
    ['missing guest language', { hostKnows: 'en', round: null }],
    ['a game status that does not exist', withRound({ status: 'paused' })],
    ['a turn index past the end', withRound({ index: 2 })],
    ['a negative turn index', withRound({ index: -1 })],
    ['a fractional turn index', withRound({ index: 0.5 })],
    ['a player that is not 1 or 2', withRound({ turns: [{ player: 3, sentence: { id: 'a', text: 'x' }, learning: 'en' }], index: 0 })],
    ['a sentence without text', withRound({ turns: [{ player: 1, sentence: { id: 'a', text: '  ' }, learning: 'en' }], index: 0 })],
    ['a very long sentence', withRound({ turns: [{ player: 1, sentence: { id: 'a', text: 'x'.repeat(301) }, learning: 'en' }], index: 0 })],
    ['a game without its reveal flag', withRound({ revealed: undefined })],
    ['a reveal flag that is not a boolean', withRound({ revealed: 'yes' })],
    ['a sentence without a translation', withRound({ turns: [{ player: 1, sentence: { id: 'a', text: 'x' }, learning: 'en' }], index: 0 })],
    ['a translation that is not text', withRound({ turns: [{ player: 1, sentence: { id: 'a', text: 'x', translation: 5 }, learning: 'en' }], index: 0 })],
    ['a very long translation', withRound({ turns: [{ player: 1, sentence: { id: 'a', text: 'x', translation: 'x'.repeat(301) }, learning: 'en' }], index: 0 })],
    ['too many turns', withRound({ turns: Array.from({ length: 21 }, () => ({ player: 1, sentence: { id: 'a', text: 'x' }, learning: 'en' })), index: 0 })],
  ])('rejects a state with %s', (_name, state) => {
    expect(parseHostMessage({ type: 'state', state })).toBeNull()
  })

  it.each([[{ type: 'state' }], [{ type: 'nope', state: roomState }], ['state'], [null]])(
    'rejects %j',
    (raw) => {
      expect(parseHostMessage(raw)).toBeNull()
    },
  )
})
