import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { confirmSentences, createGame, joinGame, sentenceOn } from '../test/devices'
import { english, german, instantGenerator } from '../test/generators'
import { createMemoryNetwork } from '../test/memoryNetwork'

async function start() {
  const user = userEvent.setup()
  const network = createMemoryNetwork()
  const { generator, asked } = instantGenerator()
  const host = await createGame(network, user, generator)
  const guest = await joinGame(network, user, host.code)
  await host.ui.findByRole('button', { name: 'Greetings and small talk' })
  return { user, host, guest, asked }
}

describe('round options', () => {
  it('plays two sentences each, without translations, unless the host chooses otherwise', async () => {
    const { user, host, guest, asked } = await start()
    await user.click(host.ui.getByRole('button', { name: 'Greetings and small talk' }))
    await host.ui.findByRole('heading', { name: 'Review your sentences' })
    expect(asked.every((request) => request.count === 2 && !request.translate)).toBe(true)
    await confirmSentences(host, guest, user)
    await host.ui.findByText('Turn 1 of 4')
    expect(host.ui.queryByRole('button', { name: 'Show translation' })).not.toBeInTheDocument()
  })

  it('plays as many turns as the host chose', async () => {
    const { user, host, guest, asked } = await start()
    await user.selectOptions(host.ui.getByLabelText('Sentences per player'), '5')
    await user.click(host.ui.getByRole('button', { name: 'Greetings and small talk' }))
    await host.ui.findByRole('heading', { name: 'Review your sentences' })
    expect(asked.every((request) => request.count === 5)).toBe(true)
    // Each player reviews only their own five.
    await waitFor(() => expect(host.container.querySelectorAll('.preview-list li')).toHaveLength(5))
    await waitFor(() => expect(guest.container.querySelectorAll('.preview-list li')).toHaveLength(5))
    await confirmSentences(host, guest, user)
    await host.ui.findByText('Turn 1 of 10')
    await guest.ui.findByText('Turn 1 of 10')
  })

  describe('with translations', () => {
    async function startTranslated() {
      const game = await start()
      await game.user.click(game.host.ui.getByLabelText('Show the translation after each turn'))
      await game.user.click(game.host.ui.getByRole('button', { name: 'Greetings and small talk' }))
      await game.host.ui.findByRole('heading', { name: 'Review your sentences' })
      return game
    }

    it('keeps the translations out of the review, which is only about the sentences each player reads', async () => {
      const { host, guest, asked } = await startTranslated()
      expect(asked.every((request) => request.translate)).toBe(true)
      // The host reads German, so what they review is German; the English translations stay hidden.
      for (const sentence of english.slice(0, 2)) expect(host.ui.queryByText(sentence)).not.toBeInTheDocument()
      await waitFor(() => expect(guest.container.querySelectorAll('.preview-list li')).toHaveLength(2))
      for (const sentence of german.slice(0, 2)) expect(guest.ui.queryByText(sentence)).not.toBeInTheDocument()
    })

    it('hides it from both players until the speaker shows it, then moves on', async () => {
      const { user, host, guest } = await startTranslated()
      await confirmSentences(host, guest, user)
      await host.ui.findByText('Turn 1 of 4')
      await guest.ui.findByText('Turn 1 of 4')

      // Player 1 (host) reads German and translates into English; the translation is English.
      expect(host.ui.queryByText('Translation')).not.toBeInTheDocument()
      expect(guest.ui.queryByText('Translation')).not.toBeInTheDocument()
      expect(host.ui.queryByRole('button', { name: 'Next turn' })).not.toBeInTheDocument()
      expect(guest.ui.queryByRole('button', { name: /Show translation|Next turn/ })).not.toBeInTheDocument()

      await user.click(host.ui.getByRole('button', { name: 'Show translation' }))
      await host.ui.findByText('Translation')
      await guest.ui.findByText('Translation')
      expect(guest.container.querySelector('.translation')?.textContent).toBe(
        host.container.querySelector('.translation')?.textContent,
      )

      await user.click(host.ui.getByRole('button', { name: 'Next turn' }))
      await guest.ui.findByText('Turn 2 of 4')
      // The next turn is the guest's, and the translation is hidden again.
      expect(host.ui.queryByText('Translation')).not.toBeInTheDocument()
      await waitFor(() => expect(guest.ui.getByRole('button', { name: 'Show translation' })).toBeInTheDocument())
      expect(sentenceOn(guest)).toBe(sentenceOn(host))
    })

    it('lets the guest show the translation on their own turn', async () => {
      const { user, host, guest } = await startTranslated()
      await confirmSentences(host, guest, user)
      await host.ui.findByText('Turn 1 of 4')
      await user.click(host.ui.getByRole('button', { name: 'Show translation' }))
      await user.click(host.ui.getByRole('button', { name: 'Next turn' }))
      await guest.ui.findByText('Turn 2 of 4')
      await user.click(await guest.ui.findByRole('button', { name: 'Show translation' }))
      await host.ui.findByText('Translation')
      await user.click(guest.ui.getByRole('button', { name: 'Next turn' }))
      await host.ui.findByText('Turn 3 of 4')
    })

    it('plays a whole round, showing each translation first, and keeps the options for Play again', async () => {
      const { user, host, guest, asked } = await startTranslated()
      await confirmSentences(host, guest, user)
      await host.ui.findByText('Turn 1 of 4')
      for (const device of [host, guest, host, guest]) {
        await user.click(await device.ui.findByRole('button', { name: 'Show translation' }))
        await user.click(await device.ui.findByRole('button', { name: /next turn|finish round/i }))
      }
      await host.ui.findByRole('heading', { name: 'Round complete' })

      asked.length = 0
      await user.click(host.ui.getByRole('button', { name: 'Play again' }))
      await host.ui.findByRole('heading', { name: 'Review your sentences' })
      await waitFor(() => expect(asked).toHaveLength(2))
      expect(asked.every((request) => request.translate && request.count === 2 && request.fresh === false)).toBe(true)
    })
  })
})
