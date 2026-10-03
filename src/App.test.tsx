import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('starts on the language setup screen', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Tandem Game' })).toBeInTheDocument()
    expect(screen.getByLabelText('Player 1 is learning')).toBeInTheDocument()
  })

  it('moves on after the languages are chosen and can go back', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText('Player 1 is learning'), 'en')
    await user.selectOptions(screen.getByLabelText('Player 2 is learning'), 'de')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.queryByLabelText('Player 1 is learning')).not.toBeInTheDocument()
    expect(screen.getByText(/Player 1 is learning English/)).toBeInTheDocument()
    expect(screen.getByText(/Player 2 is learning German/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change languages' }))
    expect(screen.getByLabelText('Player 1 is learning')).toBeInTheDocument()
  })
})
