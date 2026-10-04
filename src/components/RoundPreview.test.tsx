import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Language } from '../content/types'
import type { Turn } from '../game/buildTurns'
import type { GenerationErrorKind } from '../generation/types'
import type { ReviewState } from '../online/protocol'
import { RoundPreview } from './RoundPreview'

const languages: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]
// Player 1 learns English and reads German; Player 2 learns German and reads English.
const turns: Turn[] = [
  { player: 1, sentence: { id: 'a', text: 'Ich kann gut schwimmen.', translation: 'I can swim well.' }, learning: 'en' },
  { player: 2, sentence: { id: 'b', text: 'She can swim very well.', translation: 'Sie kann gut schwimmen.' }, learning: 'de' },
  { player: 1, sentence: { id: 'c', text: 'Wir gehen ins Kino.', translation: 'We are going to the cinema.' }, learning: 'en' },
  { player: 2, sentence: { id: 'd', text: 'They like the cinema.', translation: 'Sie mögen das Kino.' }, learning: 'de' },
]

type Review = Pick<ReviewState, 'turns' | 'busy' | 'error' | 'confirmed'>
const review = (overrides: Partial<Review> = {}): Review => ({
  turns,
  busy: false,
  error: null,
  confirmed: [false, false],
  ...overrides,
})

interface Options {
  me?: 1 | 2
  /** Only the host can cancel a request or go back to the topics. */
  asHost?: boolean
}

function show(state: Review, { me = 1, asHost = true }: Options = {}) {
  const handlers = { onConfirm: vi.fn(), onRegenerate: vi.fn(), onCancel: vi.fn(), onBack: vi.fn() }
  render(
    <RoundPreview
      me={me}
      review={state}
      topicLabel="Greetings and small talk"
      languages={languages}
      onConfirm={handlers.onConfirm}
      onRegenerate={handlers.onRegenerate}
      {...(asHost && { onCancel: handlers.onCancel, onBack: handlers.onBack })}
    />,
  )
  return handlers
}

const items = () => within(screen.getByRole('list')).getAllByRole('listitem')

describe('RoundPreview', () => {
  it('shows Player 1 only the sentences they read, with the language they translate into', () => {
    show(review(), { me: 1 })
    expect(items().map((item) => item.textContent)).toEqual([
      expect.stringContaining('Ich kann gut schwimmen.'),
      expect.stringContaining('Wir gehen ins Kino.'),
    ])
    expect(items()[0]).toHaveTextContent('English')
    expect(screen.queryByText(/She can swim very well/)).not.toBeInTheDocument()
  })

  it('shows Player 2 only their sentences', () => {
    show(review(), { me: 2, asHost: false })
    expect(items().map((item) => item.textContent)).toEqual([
      expect.stringContaining('She can swim very well.'),
      expect.stringContaining('They like the cinema.'),
    ])
    expect(items()[0]).toHaveTextContent('German')
    expect(screen.queryByText(/Ich kann gut schwimmen/)).not.toBeInTheDocument()
  })

  it('never shows translations, even when the round has them', () => {
    show(review())
    expect(screen.queryByText('I can swim well.')).not.toBeInTheDocument()
    expect(screen.queryByText('Sie kann gut schwimmen.')).not.toBeInTheDocument()
  })

  it('names the topic and says the sentences were written by AI', () => {
    show(review())
    expect(screen.getByText(/Greetings and small talk/)).toBeInTheDocument()
    expect(screen.getByText(/written by AI/i)).toBeInTheDocument()
    expect(screen.getByText(/can contain mistakes/i)).toBeInTheDocument()
  })

  it('confirms, asks for new sentences, or (for the host) goes back', async () => {
    const user = userEvent.setup()
    const { onConfirm, onRegenerate, onBack } = show(review())
    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate with AI' }))
    await user.click(screen.getByRole('button', { name: 'Choose another topic' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onRegenerate).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('does not offer the guest a way back to the topics', () => {
    show(review(), { me: 2, asHost: false })
    expect(screen.queryByRole('button', { name: 'Choose another topic' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate with AI' })).toBeInTheDocument()
  })

  describe('confirmations', () => {
    it('says nothing while nobody has confirmed', () => {
      show(review())
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('tells the player who confirmed first that the partner is still checking, and disables the button', () => {
      show(review({ confirmed: [true, false] }), { me: 1 })
      expect(screen.getByRole('status')).toHaveTextContent(/waiting for your partner to confirm/i)
      expect(screen.getByRole('button', { name: 'Looks good' })).toBeDisabled()
    })

    it('tells the player when the partner has already confirmed theirs', () => {
      show(review({ confirmed: [false, true] }), { me: 1 })
      expect(screen.getByRole('status')).toHaveTextContent(/your partner has confirmed/i)
      expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled()
    })

    it("reads the confirmations from the viewer's side", () => {
      show(review({ confirmed: [true, false] }), { me: 2, asHost: false })
      expect(screen.getByRole('status')).toHaveTextContent(/your partner has confirmed/i)
      expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled()
    })
  })

  describe('while the AI is working', () => {
    it('shows a status and, for the host, a Cancel button; confirming and regenerating are not possible', async () => {
      const user = userEvent.setup()
      const { onCancel } = show(review({ busy: true }))
      expect(screen.getByRole('status')).toHaveTextContent(/generating new sentences/i)
      expect(screen.getByRole('button', { name: 'Looks good' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Regenerate with AI' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onCancel).toHaveBeenCalledOnce()
    })

    it('shows the guest the same status but no Cancel button', () => {
      show(review({ busy: true }), { me: 2, asHost: false })
      expect(screen.getByRole('status')).toHaveTextContent(/generating/i)
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })

    it('shows only the status when there are no sentences yet', () => {
      show(review({ busy: true, turns: [] }))
      expect(screen.getByRole('status')).toHaveTextContent(/generating sentences/i)
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Looks good' })).not.toBeInTheDocument()
    })

    it('is not called a review until there is something to review', () => {
      show(review({ busy: true, turns: [] }))
      expect(screen.getByRole('heading', { name: 'Getting your sentences ready' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Review your sentences' })).not.toBeInTheDocument()
    })

    it('stays a review while new sentences replace the ones being reviewed', () => {
      show(review({ busy: true }))
      expect(screen.getByRole('heading', { name: 'Review your sentences' })).toBeInTheDocument()
    })
  })

  describe('when generating failed', () => {
    const messages: [GenerationErrorKind, RegExp][] = [
      ['unavailable', /can't be reached/i],
      ['limit-reached', /allowance is used up.*resets at .*\d.* your time/i],
      ['invalid', /usable sentences/i],
    ]

    it.each(messages)('explains a %s failure in an alert', (error, message) => {
      show(review({ error }))
      expect(screen.getByRole('alert')).toHaveTextContent(message)
    })

    it('lets a player confirm the sentences they already had', () => {
      show(review({ error: 'unavailable' }))
      expect(screen.getByRole('alert')).toHaveTextContent(/confirm these sentences/i)
      expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Regenerate with AI' })).toBeEnabled()
    })

    it('offers the host to try again or choose another topic when there is nothing to confirm', async () => {
      const user = userEvent.setup()
      const { onRegenerate } = show(review({ error: 'invalid', turns: [] }))
      expect(screen.getByRole('alert')).toHaveTextContent(/choose another topic/i)
      expect(screen.queryByRole('button', { name: 'Looks good' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onRegenerate).toHaveBeenCalledOnce()
    })

    it('tells the guest to try again or wait for the host when there is nothing to confirm', () => {
      show(review({ error: 'invalid', turns: [] }), { me: 2, asHost: false })
      expect(screen.getByRole('alert')).toHaveTextContent(/wait for the host/i)
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  it('shows no alert when nothing went wrong', () => {
    show(review())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
