import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

async function chooseLanguages(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Player 1 is learning'), 'en')
  await user.selectOptions(screen.getByLabelText('Player 2 is learning'), 'de')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('App', () => {
  it('starts on the language setup screen', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Tandem Game' })).toBeInTheDocument()
    expect(screen.getByLabelText('Player 1 is learning')).toBeInTheDocument()
  })

  it('shows the topic picker once the languages are chosen', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)

    expect(screen.queryByLabelText('Player 1 is learning')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modal verbs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conjunctions' })).toBeInTheDocument()
  })

  it('confirms a preset topic that has sentences', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Modal verbs' }))

    expect(screen.getByText(/Player 1 is learning English/)).toBeInTheDocument()
    expect(screen.getByText(/Player 2 is learning German/)).toBeInTheDocument()
    expect(screen.getByText(/Topic: Modal verbs/)).toBeInTheDocument()
    expect(screen.getByText(/sentences are ready/i)).toBeInTheDocument()
  })

  it('says there are no sentences yet for a custom topic', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.type(screen.getByLabelText('Or enter your own topic'), 'Weather{Enter}')

    expect(screen.getByText(/Topic: Weather/)).toBeInTheDocument()
    expect(screen.getByText(/no sentences yet/i)).toBeInTheDocument()
  })

  it('shows a custom topic as plain text, never as HTML', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await chooseLanguages(user)
    await user.type(screen.getByLabelText('Or enter your own topic'), '<b>bold</b>{Enter}')

    expect(screen.getByText('Topic: <b>bold</b>')).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })

  it('can go back to choose another topic', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Modal verbs' }))
    await user.click(screen.getByRole('button', { name: 'Change topic' }))

    expect(screen.getByRole('button', { name: 'Conjunctions' })).toBeInTheDocument()
    expect(screen.queryByText(/Topic: Modal verbs/)).not.toBeInTheDocument()
  })

  it('goes back to the language setup and forgets the topic', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Modal verbs' }))
    await user.click(screen.getByRole('button', { name: 'Change languages' }))

    expect(screen.getByLabelText('Player 1 is learning')).toBeInTheDocument()
    await chooseLanguages(user)
    expect(screen.getByRole('button', { name: 'Conjunctions' })).toBeInTheDocument()
  })
})
