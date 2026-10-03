import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Language } from '../content/types'
import type { GameState } from '../game/gameReducer'
import { TurnView } from './TurnView'

const languages: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]

const turns: GameState['turns'] = [
  { player: 1, sentence: { id: 'a', text: 'Ich kann schwimmen.' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'You must leave now.' }, learning: 'de' },
]

const playing: GameState = { turns, index: 0, status: 'playing' }
const finished: GameState = { turns, index: 1, status: 'finished' }

function setup(game: GameState, props: { canAct?: boolean; onPlayAgain?: () => void } = {}) {
  const onNext = vi.fn()
  render(
    <TurnView
      game={game}
      languages={languages}
      canAct={props.canAct ?? true}
      onNext={onNext}
      onPlayAgain={props.onPlayAgain}
    />,
  )
  return { onNext, user: userEvent.setup() }
}

describe('TurnView', () => {
  it('shows the current turn and lets the acting player move on', async () => {
    const { user, onNext } = setup(playing)
    expect(screen.getByText('Turn 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Player 1, translate into English:' })).toBeInTheDocument()
    expect(screen.getByText('Ich kann schwimmen.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next turn' }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it("still shows the sentence but no button when it is the other player's turn", () => {
    setup(playing, { canAct: false })
    expect(screen.getByText('Ich kann schwimmen.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Player 1')
  })

  it('offers Finish round on the last turn', () => {
    setup({ ...playing, index: 1 })
    expect(screen.getByRole('button', { name: 'Finish round' })).toBeInTheDocument()
  })

  it('offers Play again when the round is over and the device may restart it', async () => {
    const onPlayAgain = vi.fn()
    const { user } = setup(finished, { onPlayAgain })
    expect(screen.getByRole('heading', { name: 'Round complete' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onPlayAgain).toHaveBeenCalledOnce()
  })

  it('tells a device that cannot restart the round to wait for the host', () => {
    setup(finished)
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for the host/i)
  })
})
