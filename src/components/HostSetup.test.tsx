import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { staticSource } from '../content/staticSource'
import { DEFAULT_ROUND_OPTIONS } from '../generation/types'
import { HostSetup } from './HostSetup'

const languages = staticSource.getLanguages()
const topics = [
  { id: 'greetings', name: 'Greetings and small talk' },
  { id: 'weather', name: 'Weather' },
]

function setup() {
  const onCreate = vi.fn()
  const onBack = vi.fn()
  const user = userEvent.setup()
  render(<HostSetup languages={languages} topics={topics} onCreate={onCreate} onBack={onBack} />)
  return {
    user,
    onCreate,
    onBack,
    create: screen.getByRole('button', { name: 'Create game' }),
    custom: screen.getByLabelText('Or enter your own topic'),
  }
}

describe('HostSetup', () => {
  it('cannot create the game before a language and a topic are chosen, and says what is missing', async () => {
    const { user, create, onCreate } = setup()
    expect(create).toBeDisabled()
    expect(screen.getByText('Choose a topic to create the game.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Weather' }))
    expect(create).toBeDisabled() // still no language
    expect(screen.queryByText('Choose a topic to create the game.')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('I am learning'), 'en')
    expect(create).toBeEnabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates the game with a preset topic and the default options', async () => {
    const { user, create, onCreate } = setup()
    await user.selectOptions(screen.getByLabelText('I am learning'), 'en')
    await user.click(screen.getByRole('button', { name: 'Weather' }))
    await user.click(create)
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({ learning: 'en', topic: 'weather', options: DEFAULT_ROUND_OPTIONS })
  })

  it('creates the game with the options the host chose', async () => {
    const { user, create, onCreate } = setup()
    await user.selectOptions(screen.getByLabelText('I am learning'), 'de')
    await user.selectOptions(screen.getByLabelText('Sentences per player'), '4')
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'hard')
    await user.click(screen.getByLabelText('Show the translation after each turn'))
    await user.click(screen.getByRole('button', { name: 'Greetings and small talk' }))
    await user.click(create)
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({
      learning: 'de',
      topic: 'greetings',
      options: { count: 4, translate: true, difficulty: 'hard' },
    })
  })

  it('marks the chosen preset, and only that one', async () => {
    const { user } = setup()
    const weather = screen.getByRole('button', { name: 'Weather' })
    const greetings = screen.getByRole('button', { name: 'Greetings and small talk' })
    expect(weather).toHaveAttribute('aria-pressed', 'false')
    await user.click(weather)
    expect(weather).toHaveAttribute('aria-pressed', 'true')
    await user.click(greetings)
    expect(weather).toHaveAttribute('aria-pressed', 'false')
    expect(greetings).toHaveAttribute('aria-pressed', 'true')
  })

  it('takes a custom topic, trimmed, and lets typing replace a chosen preset', async () => {
    const { user, create, custom, onCreate } = setup()
    await user.selectOptions(screen.getByLabelText('I am learning'), 'en')
    await user.click(screen.getByRole('button', { name: 'Weather' }))
    await user.type(custom, '  my pet dragon  ')
    expect(screen.getByRole('button', { name: 'Weather' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(create)
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({ learning: 'en', topic: 'my pet dragon', options: DEFAULT_ROUND_OPTIONS })
  })

  it('lets choosing a preset replace what was typed', async () => {
    const { user, create, custom, onCreate } = setup()
    await user.selectOptions(screen.getByLabelText('I am learning'), 'en')
    await user.type(custom, 'my pet dragon')
    await user.click(screen.getByRole('button', { name: 'Weather' }))
    expect(custom).toHaveValue('')
    await user.click(create)
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ topic: 'weather' }))
  })

  it('treats a blank custom topic as no topic', async () => {
    const { user, create, custom, onCreate } = setup()
    await user.selectOptions(screen.getByLabelText('I am learning'), 'en')
    await user.type(custom, '    ')
    expect(create).toBeDisabled()
    await user.type(custom, '{Enter}')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('clears the topic again when the typed text is deleted', async () => {
    const { user, create, custom } = setup()
    await user.selectOptions(screen.getByLabelText('I am learning'), 'en')
    await user.type(custom, 'dragons')
    expect(create).toBeEnabled()
    await user.clear(custom)
    expect(create).toBeDisabled()
  })

  it('limits the length of a custom topic', () => {
    expect(setup().custom).toHaveAttribute('maxlength', '60')
  })

  it('goes back', async () => {
    const { user, onBack } = setup()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
