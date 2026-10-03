import { expect, test, type Page } from '@playwright/test'
import { parseModelOutput } from '../src/generation/validate'
import { confirmSentences, playRound, reviewedTurns, startGame, TOPIC, type Turn } from './game'

// Which requests go to the Worker; E2E_WORKER_PATTERN aims this at a local Worker.
const WORKER = new RegExp(process.env.E2E_WORKER_PATTERN ?? 'workers\\.dev')

/** Player 1 is learning English so reads German; Player 2 is learning German so reads English. */
function expectUsableSentences(turns: Turn[]) {
  for (const [player, language] of [[1, 'de'], [2, 'en']] as const) {
    const sentences = turns.filter((turn) => turn.player === player).map((turn) => turn.text)
    expect(parseModelOutput({ sentences }, language, sentences.length), `Player ${player} sentences: ${sentences.join(' | ')}`).toMatchObject({ ok: true })
  }
}

/** Resolves when the Worker has answered the browser's request successfully. */
const workerAnswered = (page: Page) =>
  page.waitForResponse((response) => WORKER.test(response.url()) && response.request().method() === 'POST' && response.ok())

test('a preset topic is written by the AI, can be regenerated, and is played on both devices', async ({ browser }) => {
  const game = await startGame(browser)
  const { host } = game

  const answered = workerAnswered(host)
  await host.getByRole('button', { name: TOPIC }).click()
  await answered
  await expect(host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })
  const first = await reviewedTurns(game)
  expectUsableSentences(first)

  const again = workerAnswered(host)
  await host.getByRole('button', { name: 'Regenerate with AI' }).click()
  await again
  await expect(host.getByRole('button', { name: 'Regenerate with AI' })).toBeEnabled({ timeout: 30_000 })
  // The guest's screen follows the host's: its button is back once the new sentences have arrived.
  await expect(game.guest.getByRole('button', { name: 'Looks good' })).toBeEnabled({ timeout: 30_000 })
  const second = await reviewedTurns(game)
  expectUsableSentences(second)

  await confirmSentences(game)
  await playRound(game, second)
})

test('the host can choose fewer sentences with translations, shown to both after each turn', async ({ browser }) => {
  const game = await startGame(browser)
  const { host } = game

  await host.getByLabel('Sentences per player').selectOption('1')
  await host.getByLabel('Show the translation after each turn').check()
  const answered = workerAnswered(host)
  await host.getByRole('button', { name: TOPIC }).click()
  await answered
  await expect(host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })

  const turns = await reviewedTurns(game, 1)
  expectUsableSentences(turns)

  await confirmSentences(game)
  const translations = await playRound(game, turns, { translated: true })
  // Player 1 reads German and translates into English; Player 2 the other way round.
  for (const [player, language] of [[1, 'en'], [2, 'de']] as const) {
    const translation = translations.find((turn) => turn.player === player)?.text ?? ''
    expect(parseModelOutput({ sentences: [translation] }, language, 1), `Player ${player} translation: ${translation}`).toMatchObject({ ok: true })
  }
})

test('a custom topic is written by the AI and played on both devices', async ({ browser }) => {
  const game = await startGame(browser)
  const { host } = game

  const answered = workerAnswered(host)
  await host.getByLabel('Or enter your own topic').fill('A day at the beach')
  await host.getByRole('button', { name: 'Use this topic' }).click()
  await answered
  await expect(host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })

  const generated = await reviewedTurns(game)
  expectUsableSentences(generated)

  await confirmSentences(game)
  await playRound(game, generated)
})

test('when the AI service cannot be reached, the host is told and nothing starts', async ({ browser }) => {
  const { host, guest } = await startGame(browser)
  await host.route(WORKER, (route) => route.abort())

  for (const pick of [
    () => host.getByRole('button', { name: TOPIC }).click(),
    async () => {
      await host.getByLabel('Or enter your own topic').fill('A day at the beach')
      await host.getByRole('button', { name: 'Use this topic' }).click()
    },
  ]) {
    await pick()
    await expect(host.getByRole('alert')).toContainText("can't be reached")
    await expect(host.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(host.getByRole('button', { name: 'Looks good' })).toHaveCount(0)
    // The guest is told too, and can wait for the host to choose again.
    await expect(guest.getByRole('alert')).toContainText("can't be reached", { timeout: 30_000 })
    await host.getByRole('button', { name: 'Choose another topic' }).click()
    await expect(guest.getByText('Waiting for the host to choose a topic…')).toBeVisible({ timeout: 30_000 })
  }
  await expect(guest.getByText('Waiting for the host to choose a topic…')).toBeVisible()
})
