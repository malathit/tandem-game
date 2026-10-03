import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Language } from '../content/types'
import { LanguageSetup } from './LanguageSetup'

const languages: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]

function setup() {
  const onContinue = vi.fn()
  const user = userEvent.setup()
  render(<LanguageSetup languages={languages} onContinue={onContinue} />)
  return {
    user,
    onContinue,
    player1: screen.getByLabelText('Player 1 is learning'),
    player2: screen.getByLabelText('Player 2 is learning'),
    continueButton: screen.getByRole('button', { name: 'Continue' }),
  }
}

describe('LanguageSetup', () => {
  it('offers every language to both players', () => {
    const { player1, player2 } = setup()
    for (const select of [player1, player2]) {
      expect(select).toHaveDisplayValue('Choose a language')
      expect(within(select).getByRole('option', { name: 'English' })).toBeInTheDocument()
      expect(within(select).getByRole('option', { name: 'German' })).toBeInTheDocument()
    }
  })

  it('disables Continue until both players have chosen', async () => {
    const { user, player1, continueButton } = setup()
    expect(continueButton).toBeDisabled()
    await user.selectOptions(player1, 'de')
    expect(continueButton).toBeDisabled()
  })

  it('reports the chosen languages when Continue is clicked', async () => {
    const { user, onContinue, player1, player2, continueButton } = setup()
    await user.selectOptions(player1, 'en')
    await user.selectOptions(player2, 'de')
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(['en', 'de'])
  })

  it('blocks Continue and explains why when both players pick the same language', async () => {
    const { user, onContinue, player1, player2, continueButton } = setup()
    await user.selectOptions(player1, 'de')
    await user.selectOptions(player2, 'de')
    expect(screen.getByRole('alert')).toHaveTextContent(/different languages/i)
    expect(continueButton).toBeDisabled()
    await user.click(continueButton)
    expect(onContinue).not.toHaveBeenCalled()
  })

  it('shows no warning before both players have chosen', async () => {
    const { user, player1 } = setup()
    await user.selectOptions(player1, 'de')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lets a player change their mind', async () => {
    const { user, onContinue, player1, player2, continueButton } = setup()
    await user.selectOptions(player1, 'de')
    await user.selectOptions(player2, 'de')
    await user.selectOptions(player2, 'en')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(continueButton)
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(['de', 'en'])
  })
})
