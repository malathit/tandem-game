import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GenerationError, type SentenceGenerator } from '../generation/generator'
import type { GenerationErrorKind } from '../generation/types'
import { confirmSentences, createGame, joinGame, reviewing, sentenceOn, startJoining, type HostChoices } from '../test/devices'
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
      return { sentences: answers[request.language as 'de' | 'en'] }
    },
  }
  return { generator, signals, release }
}

function failingGenerator(kind: GenerationErrorKind) {
  const generator: SentenceGenerator = { generate: () => Promise.reject(new GenerationError(kind)) }
  return generator
}

/** The host sets the topic first; the sentences are asked for as soon as the guest has joined. */
async function startWithGenerator(generator: SentenceGenerator, choices: HostChoices = {}) {
  const user = userEvent.setup()
  const network = createMemoryNetwork()
  const host = await createGame(network, user, generator, choices)
  const guest = await joinGame(network, user, host.code)
  await reviewing(host)
  return { user, host, guest }
}

describe('hosting with AI sentences', () => {
  describe('a custom topic', () => {
    it('is generated, reviewed by each player, then played by both devices', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator, { customTopic: 'my pet dragon' })

      await host.ui.findByRole('heading', { name: 'Review your sentences' })
      expect(asked.map((request) => request.language).sort()).toEqual(['de', 'en'])
      expect(asked.every((request) => request.topic.kind === 'custom' && !request.fresh)).toBe(true)
      // Each player reviews the sentences they will read, which are in their own language.
      expect(await host.ui.findByText(german[0])).toBeInTheDocument()
      expect(host.ui.queryByText(english[0])).not.toBeInTheDocument()
      expect(host.ui.getByText(/written by AI/i)).toBeInTheDocument()
      expect(await guest.ui.findByText(english[0])).toBeInTheDocument()
      expect(guest.ui.queryByText(german[0])).not.toBeInTheDocument()

      await confirmSentences(host, guest, user)
      await host.ui.findByText('Turn 1 of 4')
      await guest.ui.findByText('Turn 1 of 4')
      expect(german).toContain(sentenceOn(host))
      expect(sentenceOn(guest)).toBe(sentenceOn(host))
      expect(host.ui.getByText(/Topic: my pet dragon/)).toBeInTheDocument()
    })

    it('tells the guest sentences are being written from the moment they join, never that the host still has to choose', async () => {
      const { generator, release } = slowGenerator()
      const user = userEvent.setup()
      const network = createMemoryNetwork()
      const host = await createGame(network, user, generator, { customTopic: 'my pet dragon' })
      const guest = await startJoining(network, user, host.code)

      // Even a flash of the wrong message counts, so look at every change to the guest's screen.
      let sawWaiting = false
      const watch = new MutationObserver(() => {
        sawWaiting ||= /waiting for the host to choose a topic/i.test(guest.container.textContent ?? '')
      })
      watch.observe(guest.container, { subtree: true, childList: true, characterData: true })

      await user.selectOptions(await guest.ui.findByLabelText('I speak'), 'en')
      await user.click(guest.ui.getByRole('button', { name: 'Continue' }))
      await waitFor(() => expect(guest.ui.getByRole('status')).toHaveTextContent(/generating/i))
      expect(guest.ui.getByText(/Topic: my pet dragon/)).toBeInTheDocument()
      watch.disconnect()
      expect(sawWaiting).toBe(false)
      release()
    })

    it('shows a loading state with Cancel, and Cancel returns to the topics', async () => {
      const { generator, signals, release } = slowGenerator()
      const { user, host, guest } = await startWithGenerator(generator, { customTopic: 'my pet dragon' })

      expect(await host.ui.findByRole('status')).toHaveTextContent(/generating/i)
      expect(host.ui.queryByRole('button', { name: 'Looks good' })).not.toBeInTheDocument()
      // The guest sees that sentences are on the way, but cannot cancel them.
      await waitFor(() => expect(guest.ui.getByRole('status')).toHaveTextContent(/generating/i))
      expect(guest.ui.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Cancel' }))
      await host.ui.findByRole('button', { name: 'Greetings and small talk' })
      await guest.ui.findByText(/waiting for the host to choose a topic/i)
      expect(signals.every((signal) => signal?.aborted)).toBe(true)
      release()
      // The late answer must not bring the review screen back.
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(host.ui.queryByRole('heading', { name: 'Review your sentences' })).not.toBeInTheDocument()
    })

    it('explains a failure to both players and lets the host choose another topic', async () => {
      const { user, host, guest } = await startWithGenerator(failingGenerator('limit-reached'), { customTopic: 'my pet dragon' })

      expect(await host.ui.findByRole('alert')).toHaveTextContent(/allowance is used up/i)
      expect(host.ui.queryByRole('button', { name: 'Looks good' })).not.toBeInTheDocument()
      expect(await guest.ui.findByRole('alert')).toHaveTextContent(/allowance is used up/i)
      expect(guest.ui.queryByRole('button', { name: 'Looks good' })).not.toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Choose another topic' }))
      expect(await host.ui.findByRole('button', { name: 'Greetings and small talk' })).toBeInTheDocument()
      expect(await guest.ui.findByText(/waiting for the host to choose a topic/i)).toBeInTheDocument()
    })
  })

  describe('a preset topic', () => {
    it('is generated, reviewed, then played by both devices', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)

      await host.ui.findByRole('heading', { name: 'Review your sentences' })
      expect(asked.map((request) => request.language).sort()).toEqual(['de', 'en'])
      expect(asked.every((request) => request.topic.kind === 'preset' && request.topic.id === 'greetings' && !request.fresh)).toBe(true)
      expect(host.ui.getByText(/written by AI/i)).toBeInTheDocument()
      expect(host.ui.getByText(/Topic: Greetings and small talk/)).toBeInTheDocument()

      await confirmSentences(host, guest, user)
      await host.ui.findByText('Turn 1 of 4')
      await guest.ui.findByText('Turn 1 of 4')
      expect(german).toContain(sentenceOn(host))
      expect(host.ui.getByText(/Topic: Greetings and small talk/)).toBeInTheDocument()
    })

    it('asks for fresh sentences when the host regenerates, and plays exactly what was reviewed', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)

      await user.click(await host.ui.findByRole('button', { name: 'Regenerate with AI' }))
      await waitFor(() => expect(asked).toHaveLength(4))
      expect(asked.slice(2).every((request) => request.fresh)).toBe(true)

      await confirmSentences(host, guest, user)
      await guest.ui.findByText('Turn 1 of 4')
      expect(german).toContain(sentenceOn(host))
    })

    it('starts the round only when both players have confirmed', async () => {
      const { generator } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)

      await user.click(await host.ui.findByRole('button', { name: 'Looks good' }))
      expect(host.ui.getByRole('status')).toHaveTextContent(/waiting for your partner to confirm/i)
      expect(await guest.ui.findByRole('status')).toHaveTextContent(/your partner has confirmed/i)
      expect(host.ui.queryByText('Turn 1 of 4')).not.toBeInTheDocument()

      await user.click(guest.ui.getByRole('button', { name: 'Looks good' }))
      await host.ui.findByText('Turn 1 of 4')
      await guest.ui.findByText('Turn 1 of 4')
    })

    it('lets the guest ask for new sentences, which replaces both players\' sentences and their confirmations', async () => {
      const { generator, asked } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)
      await user.click(await host.ui.findByRole('button', { name: 'Looks good' }))
      await guest.ui.findByRole('status')

      await user.click(guest.ui.getByRole('button', { name: 'Regenerate with AI' }))
      await waitFor(() => expect(asked).toHaveLength(4))
      expect(asked.slice(2).every((request) => request.fresh)).toBe(true)

      // The host's confirmation is gone, so the round has not started and the host has to confirm again.
      await waitFor(() => expect(host.ui.getByRole('button', { name: 'Looks good' })).toBeEnabled())
      expect(host.ui.queryByText('Turn 1 of 4')).not.toBeInTheDocument()
      await confirmSentences(host, guest, user)
      await guest.ui.findByText('Turn 1 of 4')
    })

    it("forgets the guest's confirmation when they leave before the round starts", async () => {
      const { generator } = instantGenerator()
      const { user, host, guest } = await startWithGenerator(generator)
      await user.click(await guest.ui.findByRole('button', { name: 'Looks good' }))
      await host.ui.findByRole('status')

      await user.click(guest.ui.getByRole('button', { name: 'Leave game' }))
      await waitFor(() => expect(host.ui.queryByText(/your partner has confirmed/i)).not.toBeInTheDocument())
      expect(host.ui.getByText(/your partner is disconnected/i)).toBeInTheDocument()
    })

    it('says why and offers Try again when the AI cannot be reached, and nothing can start', async () => {
      const { host, guest } = await startWithGenerator(failingGenerator('unavailable'))

      expect(await host.ui.findByRole('alert')).toHaveTextContent(/can't be reached/i)
      expect(host.ui.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(host.ui.queryByRole('button', { name: 'Looks good' })).not.toBeInTheDocument()
      expect(await guest.ui.findByRole('alert')).toHaveTextContent(/can't be reached/i)
      expect(guest.ui.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  it('asks the AI again, not for the same sentences, when playing a generated round again', async () => {
    const { generator, asked } = instantGenerator()
    const { user, host, guest } = await startWithGenerator(generator, { customTopic: 'my pet dragon' })
    await confirmSentences(host, guest, user)
    await host.ui.findByText('Turn 1 of 4')
    for (const device of [host, guest, host, guest]) {
      await user.click(await device.ui.findByRole('button', { name: /next turn|finish round/i }))
    }
    await host.ui.findByRole('heading', { name: 'Round complete' })
    expect(asked).toHaveLength(2)

    await user.click(host.ui.getByRole('button', { name: 'Play again' }))
    await host.ui.findByRole('heading', { name: 'Review your sentences' })
    await waitFor(() => expect(asked).toHaveLength(4))
    await guest.ui.findByRole('heading', { name: 'Review your sentences' })
    await confirmSentences(host, guest, user)
    await guest.ui.findByText('Turn 1 of 4')
  })

  it('never tells the guest the host still has to choose a topic when Play again starts the next round', async () => {
    const { generator } = instantGenerator()
    const { user, host, guest } = await startWithGenerator(generator, { customTopic: 'my pet dragon' })
    await confirmSentences(host, guest, user)
    await host.ui.findByText('Turn 1 of 4')
    for (const device of [host, guest, host, guest]) {
      await user.click(await device.ui.findByRole('button', { name: /next turn|finish round/i }))
    }
    await host.ui.findByRole('heading', { name: 'Round complete' })
    await guest.ui.findByRole('heading', { name: 'Round complete' })

    // Even a flash of the wrong message counts, so look at every change to the guest's screen.
    let sawWaiting = false
    const watch = new MutationObserver(() => {
      sawWaiting ||= /waiting for the host to choose a topic/i.test(guest.container.textContent ?? '')
    })
    watch.observe(guest.container, { subtree: true, childList: true, characterData: true })

    await user.click(host.ui.getByRole('button', { name: 'Play again' }))
    await guest.ui.findByRole('heading', { name: 'Review your sentences' })
    await guest.ui.findByRole('button', { name: 'Looks good' })
    watch.disconnect()
    expect(sawWaiting).toBe(false)
  })

  it('stops generating when the host leaves the game', async () => {
    const { generator, signals } = slowGenerator()
    const { user, host } = await startWithGenerator(generator, { customTopic: 'my pet dragon' })
    await host.ui.findByRole('status')

    await user.click(host.ui.getByRole('button', { name: 'Leave game' }))
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.every((signal) => signal?.aborted)).toBe(true)
  })
})
