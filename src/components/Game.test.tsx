import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Language } from '../content/types'
import type { Turn } from '../game/buildTurns'
import { Game } from './Game'

const languages: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]

const turns: Turn[] = [
  { player: 1, sentence: { id: 'a', text: 'Ich kann schwimmen.' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'You must leave now.' }, learning: 'de' },
]

function setup() {
  const onPlayAgain = vi.fn()
  const user = userEvent.setup()
  render(<Game turns={turns} languages={languages} onPlayAgain={onPlayAgain} />)
  return { user, onPlayAgain }
}

async function playToTheEnd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Next turn' }))
  await user.click(screen.getByRole('button', { name: 'Finish round' }))
}

describe('Game', () => {
  it('starts with Player 1 and their sentence', () => {
    setup()
    expect(screen.getByText('Turn 1 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Player 1, translate into English:' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ich kann schwimmen.')).toBeInTheDocument()
  })

  it('does not offer to play again while the round is running', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
  })

  it('hands over to the other player on the next turn', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Next turn' }))

    expect(screen.getByText('Turn 2 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Player 2, translate into German:' }),
    ).toBeInTheDocument()
    expect(screen.getByText('You must leave now.')).toBeInTheDocument()
    expect(screen.queryByText('Ich kann schwimmen.')).not.toBeInTheDocument()
  })

  it('offers to finish the round on the last turn, then reports it is complete', async () => {
    const { user } = setup()
    await playToTheEnd(user)

    expect(screen.getByRole('heading', { name: 'Round complete' })).toBeInTheDocument()
    expect(screen.getByText(/2 sentences/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next turn|finish/i })).not.toBeInTheDocument()
  })

  it('asks the parent to start a new round when Play again is clicked', async () => {
    const { user, onPlayAgain } = setup()
    await playToTheEnd(user)
    await user.click(screen.getByRole('button', { name: 'Play again' }))

    expect(onPlayAgain).toHaveBeenCalledOnce()
  })
})
