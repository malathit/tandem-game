import { expect, test, type Page } from '@playwright/test'
import { parseModelOutput } from '../src/generation/validate'
import { playRound, reviewedTurns, startGame, type Turn } from './game'

const WORKER = /workers\.dev/

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

test('a preset topic: hand-written first, then fresh AI sentences from the Worker, then a played round', async ({ browser }) => {
  const game = await startGame(browser)
  const { host } = game

  await host.getByRole('button', { name: 'Modal verbs' }).click()
  await expect(host.getByText('Hand-written sentences.')).toBeVisible()
  const handWritten = await reviewedTurns(host)

  const answered = workerAnswered(host)
  await host.getByRole('button', { name: 'Regenerate with AI' }).click()
  await answered
  await expect(host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })

  const generated = await reviewedTurns(host)
  expectUsableSentences(generated)
  expect(generated.map((turn) => turn.text)).not.toEqual(handWritten.map((turn) => turn.text))

  await host.getByRole('button', { name: 'Start round' }).click()
  await playRound(game, generated)
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

test('when the AI service cannot be reached, the host can still play the hand-written sentences', async ({ browser }) => {
  const game = await startGame(browser)
  const { host } = game
  await host.route(WORKER, (route) => route.abort())

  // A custom topic has nothing to fall back on.
  await host.getByLabel('Or enter your own topic').fill('A day at the beach')
  await host.getByRole('button', { name: 'Use this topic' }).click()
  await expect(host.getByRole('alert')).toContainText("can't be reached")
  await expect(host.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(host.getByRole('button', { name: 'Start round' })).toHaveCount(0)
  await host.getByRole('button', { name: 'Choose another topic' }).click()

  // A preset keeps its hand-written sentences after a failed Regenerate.
  await host.getByRole('button', { name: 'Modal verbs' }).click()
  const handWritten = await reviewedTurns(host)
  await host.getByRole('button', { name: 'Regenerate with AI' }).click()
  await expect(host.getByRole('alert')).toContainText("can't be reached")
  expect(await reviewedTurns(host)).toEqual(handWritten)

  await host.getByRole('button', { name: 'Start round' }).click()
  await playRound(game, handWritten)
})
