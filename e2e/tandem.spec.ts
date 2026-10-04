import { expect, test, type Page } from '@playwright/test'
import { parseModelOutput } from '../src/generation/validate'
import { confirmSentences, playRound, reviewedTurns, saveSettings, startGame, TOPIC, type Turn } from './game'
import { SITE_URL } from '../playwright.config'

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
  let answered: Promise<unknown> = Promise.resolve()
  const game = await startGame(browser, {}, (host) => {
    answered = workerAnswered(host)
  })
  const { host } = game

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

test('both players see each translation after the speaker shows it, or the speaker skips it', async ({ browser }) => {
  let answered: Promise<unknown> = Promise.resolve()
  const game = await startGame(browser, {}, (host) => {
    answered = workerAnswered(host)
  })
  const { host } = game

  await answered
  await expect(host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })

  const turns = await reviewedTurns(game)
  expectUsableSentences(turns)

  await confirmSentences(game)
  // Skip the third turn (Player 1's second); the other three show their translation first.
  const translations = await playRound(game, turns, { translated: true, skip: [2] })
  expect(translations).toHaveLength(3)
  // Player 1 reads German and translates into English; Player 2 the other way round.
  for (const { player, text } of translations) {
    const language = player === 1 ? 'en' : 'de'
    expect(parseModelOutput({ sentences: [text] }, language, 1), `Player ${player} translation: ${text}`).toMatchObject({ ok: true })
  }
})

test('a custom topic is written by the AI and played on both devices', async ({ browser }) => {
  let answered: Promise<unknown> = Promise.resolve()
  const game = await startGame(browser, { customTopic: 'A day at the beach' }, (host) => {
    answered = workerAnswered(host)
  })
  const { host } = game

  await answered
  await expect(host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })

  const generated = await reviewedTurns(game)
  expectUsableSentences(generated)

  await confirmSentences(game)
  await playRound(game, generated)
})

test('when the AI service cannot be reached, the host is told and nothing starts', async ({ browser }) => {
  // The sentences are asked for as soon as the guest joins, so the Worker has to be unreachable by then.
  const { host, guest } = await startGame(browser, {}, async (page) => {
    await page.route(WORKER, (route) => route.abort())
  })

  // The first attempt used the topic set before the game; after it fails, the host can pick again from the topics.
  for (const pick of [
    () => Promise.resolve(),
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

test('a hard round with more sentences is asked for with the host\'s settings and played on both devices', async ({ browser }) => {
  let asked: unknown
  const game = await startGame(browser, { count: 3, difficulty: 'hard' }, (host) => {
    host.on('request', (request) => {
      if (WORKER.test(request.url()) && request.method() === 'POST') asked = request.postDataJSON()
    })
  })
  await expect.poll(() => asked).toMatchObject({ count: 3, difficulty: 'hard' })

  await expect(game.host.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })
  const turns = await reviewedTurns(game, 3)
  expect(turns).toHaveLength(6)
  expectUsableSentences(turns)

  await confirmSentences(game)
  await playRound(game, turns)
})

test('playing alone: the AI writes German sentences, each shows its English translation, and the round can be played again', async ({ page }) => {
  await page.goto(SITE_URL)
  await saveSettings(page, { count: 2 })
  await page.getByRole('button', { name: '1 player' }).click()
  await page.getByRole('button', { name: TOPIC }).click()
  const answered = workerAnswered(page)
  await page.getByRole('button', { name: 'Start' }).click()

  await answered
  await expect(page.getByText(/Written by AI/)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Looks good' }).click()

  for (const turn of [1, 2]) {
    await expect(page.getByText(`Turn ${turn} of 2`)).toBeVisible()
    const sentence = (await page.locator('.sentence').textContent()) ?? ''
    expect(parseModelOutput({ sentences: [sentence] }, 'de', 1), `sentence: ${sentence}`).toMatchObject({ ok: true })

    await page.getByRole('button', { name: 'Show translation' }).click()
    const translation = (await page.locator('.translation').evaluate((el) => el.lastChild?.textContent)) ?? ''
    expect(parseModelOutput({ sentences: [translation] }, 'en', 1), `translation: ${translation}`).toMatchObject({ ok: true })

    await page.getByRole('button', { name: turn === 2 ? 'Finish round' : 'Next turn' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('heading', { name: 'Review your sentences' })).toBeVisible()
})
