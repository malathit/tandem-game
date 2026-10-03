import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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

describe('Game', () => {
  it('starts with Player 1 and their sentence', () => {
    render(<Game turns={turns} languages={languages} />)
    expect(screen.getByText('Turn 1 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Player 1, translate into English:' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ich kann schwimmen.')).toBeInTheDocument()
  })

  it('hands over to the other player on the next turn', async () => {
    const user = userEvent.setup()
    render(<Game turns={turns} languages={languages} />)
    await user.click(screen.getByRole('button', { name: 'Next turn' }))

    expect(screen.getByText('Turn 2 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Player 2, translate into German:' }),
    ).toBeInTheDocument()
    expect(screen.getByText('You must leave now.')).toBeInTheDocument()
    expect(screen.queryByText('Ich kann schwimmen.')).not.toBeInTheDocument()
  })

  it('offers to finish the round on the last turn, then reports it is complete', async () => {
    const user = userEvent.setup()
    render(<Game turns={turns} languages={languages} />)
    await user.click(screen.getByRole('button', { name: 'Next turn' }))
    await user.click(screen.getByRole('button', { name: 'Finish round' }))

    expect(screen.getByText('Round complete.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /turn|finish/i })).not.toBeInTheDocument()
  })
})
