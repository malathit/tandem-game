import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GenerationError, type SentenceGenerator } from '../generation/generator'
import type { GenerationErrorKind } from '../generation/types'
import { createGame, joinGame, sentenceOn } from '../test/devices'
import { english, german, instantGenerator } from '../test/generators'
import { createMemoryNetwork } from '../test/memoryNetwork'

const answers = { de: german, en: english }

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
  await host.ui.findByRole('button', { name: 'Greetings and small talk' })
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
      await host.ui.findByRole('button', { name: 'Greetings and small talk' })
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
      expect(await host.ui.findByRole('button', { name: 'Greetings and small talk' })).toBeInTheDocument()
    })
  })

  describe('a preset topic', () => {
    it('is generated, reviewed, then played by both devices', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)

      await user.click(host.ui.getByRole('button', { name: 'Greetings and small talk' }))
      await host.ui.findByRole('heading', { name: 'Review the sentences' })
      expect(asked.map((request) => request.language).sort()).toEqual(['de', 'en'])
      expect(asked.every((request) => request.topic.kind === 'preset' && request.topic.id === 'greetings' && !request.fresh)).toBe(true)
      expect(host.ui.getByText(/written by AI/i)).toBeInTheDocument()
      expect(host.ui.getByText(/Topic: Greetings and small talk/)).toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Start round' }))
      await host.ui.findByText('Turn 1 of 4')
      await guest.ui.findByText('Turn 1 of 4')
      expect(german).toContain(sentenceOn(host))
      expect(host.ui.getByText(/Topic: Greetings and small talk/)).toBeInTheDocument()
    })

    it('asks for fresh sentences on Regenerate, and plays exactly what was reviewed', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)

      await user.click(host.ui.getByRole('button', { name: 'Greetings and small talk' }))
      await user.click(await host.ui.findByRole('button', { name: 'Regenerate with AI' }))
      await waitFor(() => expect(asked).toHaveLength(4))
      expect(asked.slice(2).every((request) => request.fresh)).toBe(true)

      await user.click(host.ui.getByRole('button', { name: 'Start round' }))
      await guest.ui.findByText('Turn 1 of 4')
      expect(german).toContain(sentenceOn(host))
    })

    it('says why and offers Try again when the AI cannot be reached, and nothing can start', async () => {
      const { user, host, guest } = await startWithGenerator(failingGenerator('unavailable'))

      await user.click(host.ui.getByRole('button', { name: 'Greetings and small talk' }))
      expect(await host.ui.findByRole('alert')).toHaveTextContent(/can't be reached/i)
      expect(host.ui.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(host.ui.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument()
      expect(guest.ui.getByText(/waiting for the host to choose a topic/i)).toBeInTheDocument()
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
})
