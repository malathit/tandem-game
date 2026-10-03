import { expect, type Browser, type Page } from '@playwright/test'
import { SITE_URL } from '../playwright.config'

export interface Turn {
  player: 1 | 2
  text: string
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
  await expect(host.getByRole('button', { name: 'Modal verbs' })).toBeVisible({ timeout: 30_000 })
  return { host, guest }
}

/** The sentences on the review screen, in the order they will be played. */
export async function reviewedTurns(host: Page): Promise<Turn[]> {
  const items = host.locator('.preview-list li')
  await expect(items).toHaveCount(4)
  return items.evaluateAll((elements) =>
    elements.map((element) => ({
      player: Number((element as HTMLElement).dataset.player) as 1 | 2,
      // The sentence is the text after the "Player N translates into …" label.
      text: element.lastChild?.textContent ?? '',
    })),
  )
}

/** Plays a round to its end, checking that both devices show the same sentence on every turn. */
export async function playRound({ host, guest }: Game, turns: Turn[]) {
  for (const [index, turn] of turns.entries()) {
    await expect(host.locator('.sentence')).toHaveText(turn.text)
    await expect(guest.locator('.sentence')).toHaveText(turn.text)
    const mover = turn.player === 1 ? host : guest
    await mover.getByRole('button', { name: index === turns.length - 1 ? 'Finish round' : 'Next turn' }).click()
  }
  await expect(host.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'Round complete' })).toBeVisible()
}
