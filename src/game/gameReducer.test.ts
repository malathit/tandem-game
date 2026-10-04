import { describe, expect, it } from 'vitest'
import { createGame, gameReducer } from './gameReducer'
import type { Turn } from './buildTurns'

const turns: Turn[] = [
  { player: 1, sentence: { id: 'a', text: 'a', translation: 'a!' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'b', translation: 'b!' }, learning: 'de' },
  { player: 1, sentence: { id: 'c', text: 'c', translation: 'c!' }, learning: 'en' },
]

describe('createGame', () => {
  it('starts on the first turn', () => {
    expect(createGame(turns)).toEqual({ turns, index: 0, status: 'playing', revealed: false })
  })

  it('is finished straight away when there are no turns', () => {
    expect(createGame([]).status).toBe('finished')
  })
})

describe('gameReducer', () => {
  it('moves to the next turn', () => {
    const next = gameReducer(createGame(turns), { type: 'NEXT_TURN' })
    expect(next).toEqual({ turns, index: 1, status: 'playing', revealed: false })
  })

  it('finishes after the last turn and stays on it', () => {
    let state = createGame(turns)
    state = gameReducer(state, { type: 'NEXT_TURN' })
    state = gameReducer(state, { type: 'NEXT_TURN' })
    expect(state.status).toBe('playing')
    state = gameReducer(state, { type: 'NEXT_TURN' })
    expect(state).toEqual({ turns, index: 2, status: 'finished', revealed: false })
  })

  it('ignores NEXT_TURN once the game is finished', () => {
    const finished = { turns, index: 2, status: 'finished', revealed: false } as const
    expect(gameReducer(finished, { type: 'NEXT_TURN' })).toBe(finished)
  })

  it('does not change the state it is given', () => {
    const state = createGame(turns)
    gameReducer(state, { type: 'NEXT_TURN' })
    expect(state.index).toBe(0)
  })
})

describe('PREVIOUS_TURN', () => {
  it('moves back one turn and hides the translation again', () => {
    let state = gameReducer(createGame(turns), { type: 'NEXT_TURN' })
    state = gameReducer(gameReducer(state, { type: 'REVEAL' }), { type: 'PREVIOUS_TURN' })
    expect(state).toEqual({ turns, index: 0, status: 'playing', revealed: false })
  })

  it('stays on the first turn', () => {
    const first = createGame(turns)
    expect(gameReducer(first, { type: 'PREVIOUS_TURN' })).toBe(first)
  })

  it('reopens the last turn once the game is finished', () => {
    const finished = { turns, index: 2, status: 'finished', revealed: false } as const
    expect(gameReducer(finished, { type: 'PREVIOUS_TURN' })).toEqual({
      turns,
      index: 2,
      status: 'playing',
      revealed: false,
    })
  })

  it('finishes again when walking forward after going back from the end', () => {
    const finished = { turns, index: 2, status: 'finished', revealed: false } as const
    const reopened = gameReducer(finished, { type: 'PREVIOUS_TURN' })
    expect(gameReducer(reopened, { type: 'NEXT_TURN' })).toEqual(finished)
  })

  it('stays put on a finished game with no turns', () => {
    const empty = createGame([])
    expect(gameReducer(empty, { type: 'PREVIOUS_TURN' })).toBe(empty)
  })
})

describe('revealing the translation', () => {
  it('shows the translation of the current turn', () => {
    expect(gameReducer(createGame(turns), { type: 'REVEAL' }).revealed).toBe(true)
  })

  it('hides it again on the next turn, and when the round ends', () => {
    let state = gameReducer(createGame(turns), { type: 'REVEAL' })
    state = gameReducer(state, { type: 'NEXT_TURN' })
    expect(state).toMatchObject({ index: 1, revealed: false })
    state = gameReducer(gameReducer(state, { type: 'REVEAL' }), { type: 'NEXT_TURN' })
    state = gameReducer(gameReducer(state, { type: 'REVEAL' }), { type: 'NEXT_TURN' })
    expect(state).toMatchObject({ status: 'finished', revealed: false })
  })

  it('does nothing once the game is finished', () => {
    const finished = { turns, index: 2, status: 'finished', revealed: false } as const
    expect(gameReducer(finished, { type: 'REVEAL' })).toBe(finished)
  })
})
