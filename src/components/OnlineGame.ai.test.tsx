import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { staticSource } from '../content/staticSource'
import { GenerationError, type SentenceGenerator } from '../generation/generator'
import type { GenerateRequest, GenerationErrorKind } from '../generation/types'
import { createGame, joinGame, sentenceOn } from '../test/devices'
import { createMemoryNetwork } from '../test/memoryNetwork'

const german = ['Mein Drache frisst gerne Süßigkeiten.', 'Der Drache hat kleine grüne Schuppen.']
const english = ['My dragon likes to eat sweets.', 'The dragon has small green scales.']
const answers = { de: german, en: english }

/** A generator that answers at once, and remembers what it was asked. */
function instantGenerator(language: Record<string, string[]> = answers) {
  const asked: GenerateRequest[] = []
  const generator: SentenceGenerator = {
    generate: async (request) => {
      asked.push(request)
      return language[request.language]
    },
  }
  return { generator, asked }
}

/** A generator that waits until the test says so, so the "generating" screen can be looked at. */
function slowGenerator() {
  const signals: (AbortSignal | undefined)[] = []
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const generator: SentenceGenerator = {
    generate: async (request, signal) => {
      signals.push(signal)
      await gate
      if (signal?.aborted) throw new GenerationError('cancelled')
      return answers[request.language as 'de' | 'en']
    },
  }
  return { generator, signals, release }
}

function failingGenerator(kind: GenerationErrorKind) {
  const generator: SentenceGenerator = { generate: () => Promise.reject(new GenerationError(kind)) }
  return generator
}

async function startWithGenerator(generator: SentenceGenerator) {
  const user = userEvent.setup()
  const network = createMemoryNetwork()
  const host = await createGame(network, user, generator)
  const guest = await joinGame(network, user, host.code)
  await host.ui.findByRole('button', { name: 'Modal verbs' })
  return { user, host, guest }
}

describe('hosting with AI sentences', () => {
  describe('a custom topic', () => {
    it('is generated, reviewed, then played by both devices', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)

      await user.type(host.ui.getByLabelText('Or enter your own topic'), 'my pet dragon{Enter}')
      await host.ui.findByRole('heading', { name: 'Review the sentences' })
      expect(asked.map((request) => request.language).sort()).toEqual(['de', 'en'])
      expect(asked.every((request) => request.topic.kind === 'custom' && !request.fresh)).toBe(true)
      expect(host.ui.getByText(german[0])).toBeInTheDocument()
      expect(host.ui.getByText(english[1])).toBeInTheDocument()
      expect(host.ui.getByText(/written by AI/i)).toBeInTheDocument()
      // The guest is not shown the sentences before the round starts.
      expect(guest.ui.getByText(/waiting for the host to choose a topic/i)).toBeInTheDocument()
      expect(guest.ui.queryByText(german[0])).not.toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Start round' }))
      await host.ui.findByText('Turn 1 of 4')
      await guest.ui.findByText('Turn 1 of 4')
      expect(german).toContain(sentenceOn(host))
      expect(sentenceOn(guest)).toBe(sentenceOn(host))
      expect(host.ui.getByText(/Topic: my pet dragon/)).toBeInTheDocument()
    })

    it('shows a loading state with Cancel, and Cancel returns to the topics', async () => {
      const { generator, signals, release } = slowGenerator()
      const { user, host } = await startWithGenerator(generator)

      await user.type(host.ui.getByLabelText('Or enter your own topic'), 'my pet dragon{Enter}')
      expect(await host.ui.findByRole('status')).toHaveTextContent(/generating/i)
      expect(host.ui.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Cancel' }))
      await host.ui.findByRole('button', { name: 'Modal verbs' })
      expect(signals.every((signal) => signal?.aborted)).toBe(true)
      release()
      // The late answer must not bring the review screen back.
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(host.ui.queryByRole('heading', { name: 'Review the sentences' })).not.toBeInTheDocument()
    })

    it('explains a failure and lets the host choose another topic, keeping the guest waiting', async () => {
      const { user, host, guest } = await startWithGenerator(failingGenerator('limit-reached'))

      await user.type(host.ui.getByLabelText('Or enter your own topic'), 'my pet dragon{Enter}')
      expect(await host.ui.findByRole('alert')).toHaveTextContent(/allowance is used up/i)
      expect(host.ui.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument()
      expect(guest.ui.getByText(/waiting for the host to choose a topic/i)).toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Choose another topic' }))
      expect(await host.ui.findByRole('button', { name: 'Modal verbs' })).toBeInTheDocument()
    })
  })

  describe('a preset topic', () => {
    it('is reviewed with its hand-written sentences first, without calling the AI', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host } = await startWithGenerator(generator)

      await user.click(host.ui.getByRole('button', { name: 'Modal verbs' }))
      await host.ui.findByRole('heading', { name: 'Review the sentences' })
      expect(host.ui.getByText(/hand-written/i)).toBeInTheDocument()
      const shown = [...host.container.querySelectorAll('.preview-list li')].map((li) => li.textContent ?? '')
      const handWritten = [...staticSource.getSentences('de', 'modal-verbs'), ...staticSource.getSentences('en', 'modal-verbs')]
      expect(shown).toHaveLength(4)
      expect(shown.every((text) => handWritten.some((sentence) => text.includes(sentence.text)))).toBe(true)
      expect(asked).toHaveLength(0)
    })

    it('swaps in AI sentences on Regenerate, and plays exactly what was reviewed', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)

      await user.click(host.ui.getByRole('button', { name: 'Modal verbs' }))
      await user.click(await host.ui.findByRole('button', { name: 'Regenerate with AI' }))
      await host.ui.findByText(/written by AI/i)
      expect(asked.every((request) => request.topic.kind === 'preset' && request.fresh)).toBe(true)
      expect(host.ui.getByText(german[1])).toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Start round' }))
      await host.ui.findByText('Turn 1 of 4')
      await guest.ui.findByText('Turn 1 of 4')
      expect(german).toContain(sentenceOn(host))
    })

    it('keeps the hand-written sentences and says why when Regenerate fails, and the round can still start', async () => {
      const { user, host, guest } = await startWithGenerator(failingGenerator('unavailable'))

      await user.click(host.ui.getByRole('button', { name: 'Modal verbs' }))
      await user.click(await host.ui.findByRole('button', { name: 'Regenerate with AI' }))
      expect(await host.ui.findByRole('alert')).toHaveTextContent(/can't be reached/i)
      expect(host.ui.getByText(/hand-written/i)).toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Start round' }))
      await guest.ui.findByText('Turn 1 of 4')
      const handWritten = staticSource.getSentences('de', 'modal-verbs').map((s) => s.text)
      expect(handWritten).toContain(sentenceOn(host))
    })
  })

  it('asks the AI again, not for the same sentences, when playing a generated round again', async () => {
    const { generator, asked } = instantGenerator()
    const { user, host, guest } = await startWithGenerator(generator)
    await user.type(host.ui.getByLabelText('Or enter your own topic'), 'my pet dragon{Enter}')
    await user.click(await host.ui.findByRole('button', { name: 'Start round' }))
    await host.ui.findByText('Turn 1 of 4')
    for (const device of [host, guest, host, guest]) {
      await user.click(await device.ui.findByRole('button', { name: /next turn|finish round/i }))
    }
    await host.ui.findByRole('heading', { name: 'Round complete' })
    expect(asked).toHaveLength(2)

    await user.click(host.ui.getByRole('button', { name: 'Play again' }))
    await host.ui.findByRole('heading', { name: 'Review the sentences' })
    await waitFor(() => expect(asked).toHaveLength(4))
    expect(guest.ui.getByText(/waiting for the host to (choose a topic|start another round)/i)).toBeInTheDocument()
    await user.click(host.ui.getByRole('button', { name: 'Start round' }))
    await guest.ui.findByText('Turn 1 of 4')
  })

  it('stops generating when the host leaves the game', async () => {
    const { generator, signals } = slowGenerator()
    const { user, host } = await startWithGenerator(generator)
    await user.type(host.ui.getByLabelText('Or enter your own topic'), 'my pet dragon{Enter}')
    await host.ui.findByRole('status')

    await user.click(host.ui.getByRole('button', { name: 'Leave game' }))
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.every((signal) => signal?.aborted)).toBe(true)
  })

  it('starts a preset straight away, with no review step, when no generator is configured', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    await joinGame(network, user, host.code)
    await user.click(await host.ui.findByRole('button', { name: 'Modal verbs' }))
    await host.ui.findByText('Turn 1 of 4')
    expect(host.ui.queryByRole('heading', { name: 'Review the sentences' })).not.toBeInTheDocument()
    expect(host.ui.queryByRole('button', { name: 'Regenerate with AI' })).not.toBeInTheDocument()
  })
})
