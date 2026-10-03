import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { staticSource } from './content/staticSource'

const texts = (language: 'en' | 'de', topic: string) =>
  staticSource.getSentences(language, topic).map((s) => s.text)

const hasText = (allowed: string[]) => (content: string) => allowed.includes(content)

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

  it('starts with Player 1 reading a German sentence after a preset topic is chosen', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Modal verbs' }))

    expect(screen.getByText(/Topic: Modal verbs/)).toBeInTheDocument()
    expect(screen.getByText('Turn 1 of 4')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Player 1, translate into English:' }),
    ).toBeInTheDocument()
    expect(screen.getByText(hasText(texts('de', 'modal-verbs')))).toBeInTheDocument()
  })

  it('plays a whole round, alternating players and languages', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Conjunctions' }))

    const headings = ['Player 1, translate into English:', 'Player 2, translate into German:']
    for (const turn of [0, 1, 2, 3]) {
      expect(screen.getByRole('heading', { name: headings[turn % 2] })).toBeInTheDocument()
      const allowed = turn % 2 === 0 ? texts('de', 'conjunctions') : texts('en', 'conjunctions')
      expect(screen.getByText(hasText(allowed))).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: turn === 3 ? 'Finish round' : 'Next turn' }))
    }
    expect(screen.getByRole('heading', { name: 'Round complete' })).toBeInTheDocument()
  })

  it('starts a fresh round on the same topic when Play again is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Modal verbs' }))
    for (const label of ['Next turn', 'Next turn', 'Next turn', 'Finish round']) {
      await user.click(screen.getByRole('button', { name: label }))
    }

    const random = vi.spyOn(Math, 'random')
    await user.click(screen.getByRole('button', { name: 'Play again' }))

    expect(random).toHaveBeenCalled() // the sentences were shuffled again
    random.mockRestore()
    expect(screen.queryByRole('heading', { name: 'Round complete' })).not.toBeInTheDocument()
    expect(screen.getByText('Turn 1 of 4')).toBeInTheDocument()
    expect(screen.getByText(/Topic: Modal verbs/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Player 1, translate into English:' }),
    ).toBeInTheDocument()
  })

  it('lets the players pick a new topic after a round', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Modal verbs' }))
    for (const label of ['Next turn', 'Next turn', 'Next turn', 'Finish round']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: 'Change topic' }))

    expect(screen.getByRole('button', { name: 'Conjunctions' })).toBeInTheDocument()
  })

  it('says there are no sentences yet for a custom topic', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.type(screen.getByLabelText('Or enter your own topic'), 'Weather{Enter}')

    expect(screen.getByText(/Topic: Weather/)).toBeInTheDocument()
    expect(screen.getByText(/no sentences yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/Turn 1/)).not.toBeInTheDocument()
  })

  it('shows a custom topic as plain text, never as HTML', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await chooseLanguages(user)
    await user.type(screen.getByLabelText('Or enter your own topic'), '<b>bold</b>{Enter}')

    expect(screen.getByText('Topic: <b>bold</b>')).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })

  it('can go back to choose another topic mid-round', async () => {
    const user = userEvent.setup()
    render(<App />)
    await chooseLanguages(user)
    await user.click(screen.getByRole('button', { name: 'Modal verbs' }))
    await user.click(screen.getByRole('button', { name: 'Change topic' }))

    expect(screen.getByRole('button', { name: 'Conjunctions' })).toBeInTheDocument()
    expect(screen.queryByText(/Turn 1/)).not.toBeInTheDocument()
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
