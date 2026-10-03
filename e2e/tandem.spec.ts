import { expect, test, type Page } from '@playwright/test'
import { parseModelOutput } from '../src/generation/validate'
import { playRound, reviewedTurns, startGame, TOPIC, type Turn } from './game'

// Which requests go to the Worker; E2E_WORKER_PATTERN aims this at a local Worker.
const WORKER = new RegExp(process.env.E2E_WORKER_PATTERN ?? 'workers\\.dev')

/** Player 1 is learning English so reads German; Player 2 is learning German so reads English. */
function expectUsableSentences(turns: Turn[]) {
  for (const [player, language] of [[1, 'de'], [2, 'en']] as const) {
    const sentences = turns.filter((turn) => turn.player === player).map((turn) => turn.text)
    expect(parseModelOutput({ sentences }, language), `Player ${player} sentences: ${sentences.join(' | ')}`).toMatchObject({ ok: true })
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
  const first = await reviewedTurns(host)
  expectUsableSentences(first)

  const again = workerAnswered(host)
  await host.getByRole('button', { name: 'Regenerate with AI' }).click()
  await again
  await expect(host.getByRole('button', { name: 'Regenerate with AI' })).toBeEnabled({ timeout: 30_000 })
  const second = await reviewedTurns(host)
  expectUsableSentences(second)

  await host.getByRole('button', { name: 'Start round' }).click()
  await playRound(game, second)
})

test('a custom topic is written by the AI and played on both devices', async ({ browser }) => {
  const game = await startGame(browser)
  const { host } = game

  const answered = workerAnswered(host)
  await host.getByLabel('Or enter your own topic').fill('A day at the beach')
  await host.getByRole('button', { name: 'Use this topic' }).click()
  await answered
  await expect(host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })

  const generated = await reviewedTurns(host)
  expectUsableSentences(generated)

  await host.getByRole('button', { name: 'Start round' }).click()
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
    await expect(host.getByRole('button', { name: 'Start round' })).toHaveCount(0)
    await host.getByRole('button', { name: 'Choose another topic' }).click()
  }
  await expect(guest.getByText('Waiting for the host to choose a topic…')).toBeVisible()
})
