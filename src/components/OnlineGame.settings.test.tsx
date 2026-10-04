import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loadHostDefaults, loadLastTopic, saveLastTopic } from '../game/hostPreferences'
import { OnlineGame } from './OnlineGame'
import { SAVED_DEFAULTS, languages, open } from '../test/devices'
import { instantGenerator } from '../test/generators'
import { createMemoryNetwork } from '../test/memoryNetwork'

const saved = { knows: 'de', learns: 'en', options: { count: 3, difficulty: 'hard' } } as const

describe('the first visit', () => {
  it('asks for the settings first, with nothing to go back to, and saves them', async () => {
    const user = userEvent.setup()
    const { ui } = open(createMemoryNetwork(), undefined, null)
    expect(ui.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(ui.queryByRole('button', { name: '1 player' })).not.toBeInTheDocument()
    expect(ui.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    await user.selectOptions(ui.getByLabelText('I speak'), 'de')
    await user.selectOptions(ui.getByLabelText("I'm learning"), 'en')
    await user.selectOptions(ui.getByLabelText('Sentences per player'), '3')
    await user.selectOptions(ui.getByLabelText('Difficulty'), 'hard')
    await user.click(ui.getByRole('button', { name: 'Save settings' }))

    expect(loadHostDefaults()).toEqual(saved)
    expect(ui.getByRole('button', { name: '1 player' })).toBeInTheDocument()
  })

  it('does not ask again once they are saved', () => {
    const { ui } = open(createMemoryNetwork())
    expect(ui.getByRole('button', { name: '1 player' })).toBeInTheDocument()
  })
})

describe('Settings on the start screen', () => {
  it('opens the saved values, can be left with Back, and saves changes', async () => {
    const user = userEvent.setup()
    const { ui } = open(createMemoryNetwork())
    await user.click(ui.getByRole('button', { name: 'Settings' }))
    expect(ui.getByLabelText('I speak')).toHaveValue('de')
    await user.click(ui.getByRole('button', { name: 'Back' }))
    expect(ui.getByRole('button', { name: '1 player' })).toBeInTheDocument()

    await user.click(ui.getByRole('button', { name: 'Settings' }))
    await user.selectOptions(ui.getByLabelText('Difficulty'), 'easy')
    await user.click(ui.getByRole('button', { name: 'Save settings' }))
    expect(loadHostDefaults()).toEqual({ ...SAVED_DEFAULTS, options: { ...SAVED_DEFAULTS.options, difficulty: 'easy' } })
    expect(ui.getByRole('button', { name: '1 player' })).toBeInTheDocument()
  })
})

describe('creating a game from the saved settings', () => {
  it('shows a summary and starts a one-player game with the saved languages, options and topic', async () => {
    saveLastTopic('weather')
    const user = userEvent.setup()
    const { generator, asked } = instantGenerator()
    const { ui } = open(createMemoryNetwork(), generator, saved)
    await user.click(ui.getByRole('button', { name: '1 player' }))
    expect(ui.getByText('German')).toBeInTheDocument()
    expect(ui.getByText('English')).toBeInTheDocument()
    await user.click(ui.getByRole('button', { name: 'Start' }))

    await ui.findByRole('button', { name: 'Looks good' })
    expect(asked[0]).toMatchObject({
      language: 'de',
      count: 3,
      difficulty: 'hard',
      topic: { kind: 'preset', id: 'weather' },
    })
  })

  it('goes to the settings from Edit, and comes back to the summary with the changes', async () => {
    saveLastTopic('weather')
    const user = userEvent.setup()
    const { ui } = open(createMemoryNetwork(), undefined, saved)
    await user.click(ui.getByRole('button', { name: '2 players' }))
    await user.click(ui.getByRole('button', { name: 'Create a game' }))
    await user.click(ui.getByRole('button', { name: 'Edit settings' }))
    expect(ui.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    await user.selectOptions(ui.getByLabelText('Sentences per player'), '5')
    await user.click(ui.getByRole('button', { name: 'Save settings' }))
    expect(ui.getByRole('heading', { name: 'Create a game' })).toBeInTheDocument()
    expect(ui.getByText('5')).toBeInTheDocument()
    expect(loadHostDefaults()?.options.count).toBe(5)
    // The topic chosen before is still chosen.
    expect(ui.getByRole('button', { name: 'Weather' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('can leave Edit with Back to the summary, unchanged', async () => {
    const user = userEvent.setup()
    const { ui } = open(createMemoryNetwork(), undefined, saved)
    await user.click(ui.getByRole('button', { name: '1 player' }))
    await user.click(ui.getByRole('button', { name: 'Edit settings' }))
    await user.click(ui.getByRole('button', { name: 'Back' }))
    expect(ui.getByRole('heading', { name: 'Practise on your own' })).toBeInTheDocument()
    expect(loadHostDefaults()).toEqual(saved)
  })

  it('remembers the topic of the last game', async () => {
    const user = userEvent.setup()
    const { generator } = instantGenerator()
    const { ui } = open(createMemoryNetwork(), generator, saved)
    await user.click(ui.getByRole('button', { name: '1 player' }))
    expect(ui.getByText('Choose a topic to start.')).toBeInTheDocument()
    await user.click(ui.getByRole('button', { name: 'Greetings and small talk' }))
    await user.click(ui.getByRole('button', { name: 'Start' }))
    await ui.findByRole('button', { name: 'Looks good' })

    expect(loadLastTopic()).toBe('greetings')
    expect(loadHostDefaults()).toEqual(saved)
  })
})

describe('joining through an invite link', () => {
  function openInvite() {
    const view = render(<OnlineGame network={createMemoryNetwork()} languages={languages} initialCode="ZZZZ9" />)
    return within(view.container)
  }

  it('does not ask a guest for settings', async () => {
    const ui = openInvite()
    expect(await ui.findByRole('alert')).toHaveTextContent(/couldn't find a game/i) // it tried to join
    expect(ui.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('asks for them if that guest then goes on to create a game, and returns there once they are saved', async () => {
    const user = userEvent.setup()
    const ui = openInvite()
    await user.click(await ui.findByRole('button', { name: 'Leave game' }))
    await user.click(ui.getByRole('button', { name: 'Create a game' }))
    expect(ui.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    await user.selectOptions(ui.getByLabelText('I speak'), 'en')
    await user.selectOptions(ui.getByLabelText("I'm learning"), 'de')
    await user.click(ui.getByRole('button', { name: 'Save settings' }))
    expect(ui.getByRole('heading', { name: 'Create a game' })).toBeInTheDocument()
  })
})
