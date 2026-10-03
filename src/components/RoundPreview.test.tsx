import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Language } from '../content/types'
import type { Turn } from '../game/buildTurns'
import type { GenerationErrorKind } from '../generation/types'
import type { RoundSetup } from '../game/useRoundSetup'
import { RoundPreview } from './RoundPreview'

const languages: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]
const turns: Turn[] = [
  { player: 1, sentence: { id: 'a', text: 'Ich kann gut schwimmen.' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'She can swim very well.' }, learning: 'de' },
]

type Preview = Extract<RoundSetup, { phase: 'preview' }>
const setup = (overrides: Partial<Preview> = {}): Preview => ({
  phase: 'preview',
  topic: { kind: 'preset', id: 'modal-verbs' },
  turns,
  fromAi: false,
  busy: false,
  error: null,
  ...overrides,
})

function show(state: Preview) {
  const handlers = { onStart: vi.fn(), onRegenerate: vi.fn(), onCancel: vi.fn(), onBack: vi.fn() }
  render(<RoundPreview setup={state} topicLabel="Modal verbs" languages={languages} {...handlers} />)
  return handlers
}

describe('RoundPreview', () => {
  it('lists every sentence with the player who reads it and the language they translate into', () => {
    show(setup())
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Player 1')
    expect(items[0]).toHaveTextContent('Ich kann gut schwimmen.')
    expect(items[0]).toHaveTextContent('English')
    expect(items[1]).toHaveTextContent('Player 2')
    expect(items[1]).toHaveTextContent('German')
  })

  it('names the topic and says where the sentences came from', () => {
    const { rerender } = render(
      <RoundPreview setup={setup()} topicLabel="Modal verbs" languages={languages} onStart={vi.fn()} onRegenerate={vi.fn()} onCancel={vi.fn()} onBack={vi.fn()} />,
    )
    expect(screen.getByText(/Modal verbs/)).toBeInTheDocument()
    expect(screen.getByText(/hand-written/i)).toBeInTheDocument()
    rerender(
      <RoundPreview setup={setup({ fromAi: true })} topicLabel="Modal verbs" languages={languages} onStart={vi.fn()} onRegenerate={vi.fn()} onCancel={vi.fn()} onBack={vi.fn()} />,
    )
    expect(screen.getByText(/written by AI/i)).toBeInTheDocument()
    expect(screen.getByText(/can contain mistakes/i)).toBeInTheDocument()
  })

  it('starts the round, asks for new sentences, or goes back', async () => {
    const user = userEvent.setup()
    const { onStart, onRegenerate, onBack } = show(setup())
    await user.click(screen.getByRole('button', { name: 'Start round' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate with AI' }))
    await user.click(screen.getByRole('button', { name: 'Choose another topic' }))
    expect(onStart).toHaveBeenCalledOnce()
    expect(onRegenerate).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  describe('while the AI is working', () => {
    it('shows a status and a Cancel button, and does not allow starting or regenerating', async () => {
      const user = userEvent.setup()
      const { onCancel } = show(setup({ busy: true }))
      expect(screen.getByRole('status')).toHaveTextContent(/generating/i)
      expect(screen.getByRole('button', { name: 'Start round' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Regenerate with AI' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onCancel).toHaveBeenCalledOnce()
    })

    it('shows only the status when there are no sentences yet', () => {
      show(setup({ busy: true, turns: [] }))
      expect(screen.getByRole('status')).toHaveTextContent(/generating/i)
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument()
    })
  })

  describe('when generating failed', () => {
    const messages: [GenerationErrorKind, RegExp][] = [
      ['unavailable', /can't be reached/i],
      ['limit-reached', /allowance is used up.*midnight UTC/i],
      ['invalid', /usable sentences/i],
    ]

    it.each(messages)('explains a %s failure in an alert', (error, message) => {
      show(setup({ error }))
      expect(screen.getByRole('alert')).toHaveTextContent(message)
    })

    it('lets the host start with the sentences they already had', () => {
      show(setup({ error: 'unavailable' }))
      expect(screen.getByRole('alert')).toHaveTextContent(/start with these sentences/i)
      expect(screen.getByRole('button', { name: 'Start round' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Regenerate with AI' })).toBeEnabled()
    })

    it('offers to try again or choose another topic when there is nothing to start with', async () => {
      const user = userEvent.setup()
      const { onRegenerate } = show(setup({ error: 'invalid', turns: [] }))
      expect(screen.getByRole('alert')).toHaveTextContent(/choose another topic/i)
      expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onRegenerate).toHaveBeenCalledOnce()
    })
  })

  it('shows no alert when nothing went wrong', () => {
    show(setup())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
