import { expect, type Browser, type Page } from '@playwright/test'
import { SITE_URL } from '../playwright.config'

/** The preset topic the host picks unless a test says otherwise. */
export const TOPIC = 'Greetings and small talk'

export interface Turn {
  player: 1 | 2
  text: string
}

export interface Game {
  host: Page
  guest: Page
}

/** What the host sets before the invite link exists. */
export interface Settings {
  /** Typed instead of picking the preset `TOPIC`. */
  customTopic?: string
  count?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  translate?: boolean
}

/**
 * The settings every first visit begins with: German spoken, English learned, and the round options in `settings`.
 * Saving them leads to the start screen.
 */
export async function saveSettings(page: Page, settings: Settings = {}) {
  await page.getByLabel('I speak').selectOption('de')
  await page.getByLabel("I'm learning").selectOption('en')
  if (settings.count !== undefined) await page.getByLabel(/^Sentences/).selectOption(String(settings.count))
  if (settings.difficulty !== undefined) await page.getByLabel('Difficulty').selectOption(settings.difficulty)
  if (settings.translate) await page.getByLabel('Show the translation after each turn').check()
  await page.getByRole('button', { name: 'Save settings' }).click()
}

/**
 * Two separate browsers' worth of state: a host speaking German (learning English) and a guest speaking English (learning German), connected.
 * The host sets the topic and options first; once the guest has joined, the sentences are asked for at once,
 * so `ready` runs on the host's page before the guest joins, for anything that must be in place by then.
 */
export async function startGame(browser: Browser, settings: Settings = {}, ready?: (host: Page) => Promise<void> | void): Promise<Game> {
  const host = await (await browser.newContext()).newPage()
  await host.goto(SITE_URL)
  await saveSettings(host, settings)
  await host.getByRole('button', { name: '2 players' }).click()
  await host.getByRole('button', { name: 'Create a game' }).click()
  if (settings.customTopic !== undefined) {
    await host.getByLabel('Or enter your own topic').fill(settings.customTopic)
  } else {
    await host.getByRole('button', { name: TOPIC }).click()
  }
  await host.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.getByText(/^[A-Z2-9]{5}$/).textContent()) ?? ''
  await ready?.(host)

  const guest = await (await browser.newContext()).newPage()
  await guest.goto(`${SITE_URL}?join=${code}`)
  // Connecting goes through the public PeerJS broker, so allow it some time; on failure, show what the guest saw.
  // The guest has nothing to choose: once connected, the host sets their language and the review begins.
  await expect(
    guest.getByRole('heading', { name: 'Review your sentences' }),
    `the guest's screen: ${await guest.locator('main').innerText()}`,
  ).toBeVisible({ timeout: 30_000 })
  await expect(host.getByRole('heading', { name: 'Review your sentences' })).toBeVisible({ timeout: 30_000 })
  return { host, guest }
}

/** The sentences one player is shown on their review screen, in the order they will be played. */
async function ownSentences(page: Page, expected: number): Promise<string[]> {
  const items = page.locator('.preview-list li')
  await expect(items).toHaveCount(expected)
  return items.evaluateAll((elements) =>
    elements.map((element) =>
      // The sentence is the text node after the "You translate into …" label.
      [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(''),
    ),
  )
}

/** What the two review screens show together: each player only sees the sentences they read themselves. */
export async function reviewedTurns({ host, guest }: Game, perPlayer = 2): Promise<Turn[]> {
  const [first, second] = await Promise.all([ownSentences(host, perPlayer), ownSentences(guest, perPlayer)])
  return first.flatMap((text, i): Turn[] => [
    { player: 1, text },
    { player: 2, text: second[i] },
  ])
}

/** Both players say their own sentences are fine, which starts the round. */
export async function confirmSentences({ host, guest }: Game) {
  await host.getByRole('button', { name: 'Looks good' }).click()
  // The guest's screen follows the host's, so give the connection time.
  await guest.getByRole('button', { name: 'Looks good' }).click({ timeout: 30_000 })
}

/**
 * Plays a round to its end, checking that both devices show the same sentence on every turn.
 * With `translated`, each speaker shows the translation first, which is returned per player,
 * except on the turns (by index) listed in `skip`, where they go on without showing it.
 */
export async function playRound({ host, guest }: Game, turns: Turn[], { translated = false, skip = [] as number[] } = {}) {
  const translations: Turn[] = []
  for (const [index, turn] of turns.entries()) {
    await expect(host.locator('.sentence')).toHaveText(turn.text)
    await expect(guest.locator('.sentence')).toHaveText(turn.text)
    const mover = turn.player === 1 ? host : guest
    if (translated && skip.includes(index)) {
      await expect(host.locator('.translation')).toHaveCount(0)
      await expect(guest.locator('.translation')).toHaveCount(0)
      // Without showing the translation, the speaker goes straight on.
      await mover.getByRole('button', { name: index === turns.length - 1 ? 'Finish round' : 'Next turn' }).click()
      continue
    }
    if (translated) {
      // Hidden from both until the speaker shows it.
      await expect(host.locator('.translation')).toHaveCount(0)
      await expect(guest.locator('.translation')).toHaveCount(0)
      await mover.getByRole('button', { name: 'Show translation' }).click()
      await expect(host.locator('.translation')).toBeVisible()
      await expect(guest.locator('.translation')).toBeVisible()
      const shown = (await host.locator('.translation').innerText()).replace(/^Translation\s*/, '')
      await expect(guest.locator('.translation')).toContainText(shown)
      translations.push({ player: turn.player, text: shown })
    }
    await mover.getByRole('button', { name: index === turns.length - 1 ? 'Finish round' : 'Next turn' }).click()
  }
  await expect(host.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  return translations
}
