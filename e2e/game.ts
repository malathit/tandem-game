import { expect, type Browser, type Page } from '@playwright/test'
import { SITE_URL } from '../playwright.config'

/** A preset topic of the game. */
export const TOPIC = 'Greetings and small talk'

export interface Turn {
  player: 1 | 2
  text: string
  /** Only when the host asked for translations. */
  translation?: string
}

export interface Game {
  host: Page
  guest: Page
}

/** Two separate browsers' worth of state: a host learning English and a guest learning German, connected. */
export async function startGame(browser: Browser): Promise<Game> {
  const host = await (await browser.newContext()).newPage()
  await host.goto(SITE_URL)
  await host.getByRole('button', { name: 'Create a game' }).click()
  await host.getByLabel('I am learning').selectOption('en')
  await host.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.getByText(/^[A-Z2-9]{5}$/).textContent()) ?? ''

  const guest = await (await browser.newContext()).newPage()
  await guest.goto(`${SITE_URL}?join=${code}`)
  // Connecting goes through the public PeerJS broker, so allow it some time; on failure, show what the guest saw.
  await expect(guest.getByLabel('I am learning'), `the guest's screen: ${await guest.locator('main').innerText()}`).toBeVisible({
    timeout: 30_000,
  })
  await guest.getByLabel('I am learning').selectOption('de')
  await guest.getByRole('button', { name: 'Continue' }).click()

  // The host only sees the topics once the guest's choice has travelled over the real connection.
  await expect(host.getByRole('button', { name: TOPIC })).toBeVisible({ timeout: 30_000 })
  return { host, guest }
}

/** The sentences on the review screen, in the order they will be played. */
export async function reviewedTurns(host: Page, expected = 4): Promise<Turn[]> {
  const items = host.locator('.preview-list li')
  await expect(items).toHaveCount(expected)
  return items.evaluateAll((elements) =>
    elements.map((element) => ({
      player: Number((element as HTMLElement).dataset.player) as 1 | 2,
      // The sentence is the text node between the "Player N translates into …" label and the translation.
      text: [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(''),
      translation: element.querySelector('.preview-translation')?.textContent ?? undefined,
    })),
  )
}

/** Plays a round to its end, checking that both devices show the same sentence on every turn. */
export async function playRound({ host, guest }: Game, turns: Turn[]) {
  for (const [index, turn] of turns.entries()) {
    await expect(host.locator('.sentence')).toHaveText(turn.text)
    await expect(guest.locator('.sentence')).toHaveText(turn.text)
    const mover = turn.player === 1 ? host : guest
    if (turn.translation !== undefined) {
      // Hidden from both until the speaker shows it.
      await expect(host.locator('.translation')).toHaveCount(0)
      await expect(guest.locator('.translation')).toHaveCount(0)
      await mover.getByRole('button', { name: 'Show translation' }).click()
      await expect(host.locator('.translation')).toContainText(turn.translation)
      await expect(guest.locator('.translation')).toContainText(turn.translation)
    }
    await mover.getByRole('button', { name: index === turns.length - 1 ? 'Finish round' : 'Next turn' }).click()
  }
  await expect(host.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'Round complete' })).toBeVisible()
}
