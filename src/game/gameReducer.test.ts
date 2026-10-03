import { describe, expect, it } from 'vitest'
import { createGame, gameReducer } from './gameReducer'
import type { Turn } from './buildTurns'

const turns: Turn[] = [
  { player: 1, sentence: { id: 'a', text: 'a' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'b' }, learning: 'de' },
  { player: 1, sentence: { id: 'c', text: 'c' }, learning: 'en' },
]

describe('createGame', () => {
  it('starts on the first turn', () => {
    expect(createGame(turns)).toEqual({ turns, index: 0, status: 'playing' })
  })

  it('is finished straight away when there are no turns', () => {
    expect(createGame([]).status).toBe('finished')
  })
})

describe('gameReducer', () => {
  it('moves to the next turn', () => {
    const next = gameReducer(createGame(turns), { type: 'NEXT_TURN' })
    expect(next).toEqual({ turns, index: 1, status: 'playing' })
  })

  it('finishes after the last turn and stays on it', () => {
    let state = createGame(turns)
    state = gameReducer(state, { type: 'NEXT_TURN' })
    state = gameReducer(state, { type: 'NEXT_TURN' })
    expect(state.status).toBe('playing')
    state = gameReducer(state, { type: 'NEXT_TURN' })
    expect(state).toEqual({ turns, index: 2, status: 'finished' })
  })

  it('ignores NEXT_TURN once the game is finished', () => {
    const finished = { turns, index: 2, status: 'finished' } as const
    expect(gameReducer(finished, { type: 'NEXT_TURN' })).toBe(finished)
  })

  it('does not change the state it is given', () => {
    const state = createGame(turns)
    gameReducer(state, { type: 'NEXT_TURN' })
    expect(state.index).toBe(0)
  })
})
