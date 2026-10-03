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

const playing: GameState = { turns, index: 0, status: 'playing', revealed: false }
const finished: GameState = { turns, index: 1, status: 'finished', revealed: false }

function setup(game: GameState, props: { canAct?: boolean; onPlayAgain?: () => void } = {}) {
  const onNext = vi.fn()
  const onReveal = vi.fn()
  render(
    <TurnView
      game={game}
      languages={languages}
      canAct={props.canAct ?? true}
      onNext={onNext}
      onReveal={onReveal}
      onPlayAgain={props.onPlayAgain}
    />,
  )
  return { onNext, onReveal, user: userEvent.setup() }
}

const translatedTurns: GameState['turns'] = turns.map((turn) => ({
  ...turn,
  sentence: { ...turn.sentence, translation: `${turn.sentence.text} (translated)` },
}))
const translated: GameState = { turns: translatedTurns, index: 0, status: 'playing', revealed: false }

describe('TurnView with translations', () => {
  it('keeps the translation hidden and offers to show it instead of moving on', async () => {
    const { user, onReveal } = setup(translated)
    expect(screen.queryByText(/\(translated\)/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next turn' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show translation' }))
    expect(onReveal).toHaveBeenCalledOnce()
  })

  it('shows the translation once revealed, and then lets the player move on', async () => {
    const { user, onNext } = setup({ ...translated, revealed: true })
    expect(screen.getByText('Ich kann schwimmen. (translated)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show translation' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next turn' }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it("shows the other player's translation without a button once revealed", () => {
    setup({ ...translated, revealed: true }, { canAct: false })
    expect(screen.getByText('Ich kann schwimmen. (translated)')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('never shows the translation to the player waiting before the reveal', () => {
    setup(translated, { canAct: false })
    expect(screen.queryByText(/\(translated\)/)).not.toBeInTheDocument()
  })
})

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
