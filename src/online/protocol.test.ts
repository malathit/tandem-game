import { describe, expect, it } from 'vitest'
import { parseGuestMessage, parseHostMessage, type RoomState } from './protocol'

const roomState: RoomState = {
  hostLearning: 'en',
  guestLearning: 'de',
  round: {
    topic: 'modal-verbs',
    game: {
      turns: [
        { player: 1, sentence: { id: 'a', text: 'Ich kann schwimmen.' }, learning: 'en' },
        { player: 2, sentence: { id: 'b', text: 'I can swim.' }, learning: 'de' },
      ],
      index: 1,
      status: 'playing',
    },
  },
}

const withRound = (change: Record<string, unknown>) => ({
  ...roomState,
  round: { ...roomState.round, game: { ...roomState.round!.game, ...change } },
})

describe('parseGuestMessage', () => {
  it('accepts a hello with a known language', () => {
    expect(parseGuestMessage({ type: 'hello', learning: 'de' })).toEqual({
      type: 'hello',
      learning: 'de',
    })
  })

  it('accepts next-turn and drops unexpected fields', () => {
    expect(parseGuestMessage({ type: 'next-turn', extra: 'x' })).toEqual({ type: 'next-turn' })
  })

  it.each([
    [{ type: 'hello', learning: 'xx' }],
    [{ type: 'hello' }],
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

  it('accepts a lobby state with no guest and no round', () => {
    const lobby = { hostLearning: 'en', guestLearning: null, round: null }
    expect(parseHostMessage({ type: 'state', state: lobby })).toEqual({ type: 'state', state: lobby })
  })

  it.each([
    ['unknown host language', { ...roomState, hostLearning: 'xx' }],
    ['unknown guest language', { ...roomState, guestLearning: 'xx' }],
    ['missing guest language', { hostLearning: 'en', round: null }],
    ['a game status that does not exist', withRound({ status: 'paused' })],
    ['a turn index past the end', withRound({ index: 2 })],
    ['a negative turn index', withRound({ index: -1 })],
    ['a fractional turn index', withRound({ index: 0.5 })],
    ['a player that is not 1 or 2', withRound({ turns: [{ player: 3, sentence: { id: 'a', text: 'x' }, learning: 'en' }], index: 0 })],
    ['a sentence without text', withRound({ turns: [{ player: 1, sentence: { id: 'a', text: '  ' }, learning: 'en' }], index: 0 })],
    ['a very long sentence', withRound({ turns: [{ player: 1, sentence: { id: 'a', text: 'x'.repeat(301) }, learning: 'en' }], index: 0 })],
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
