import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import type { SentenceGenerator } from '../generation/generator'
import { saveHostDefaults, type HostDefaults } from '../game/hostPreferences'
import { DEFAULT_ROUND_OPTIONS, type Difficulty } from '../generation/types'
import { OnlineGame } from '../components/OnlineGame'
import { instantGenerator } from './generators'
import type { MemoryNetwork } from './memoryNetwork'

export const languages: Language[] = staticSource.getLanguages()

export type User = ReturnType<typeof userEvent.setup>

/** What the host has saved on a device unless a test says otherwise: speaking German, learning English. */
export const SAVED_DEFAULTS: HostDefaults = { knows: 'de', learns: 'en', options: DEFAULT_ROUND_OPTIONS }

/** Shows a device. It starts with `saved` settings in the browser, so the settings are not asked first; `null` is a first visit. */
export function open(network: MemoryNetwork, generator?: SentenceGenerator, saved: HostDefaults | null = SAVED_DEFAULTS) {
  if (saved) saveHostDefaults(saved)
  const view = render(<OnlineGame network={network} languages={languages} generator={generator} />)
  return { ...view, ui: within(view.container) }
}

/** The label of the step the screen says we are on. */
export const currentStep = (device: { container: HTMLElement }) =>
  device.container.querySelector('[aria-current="step"]')?.textContent

/** What the host sets for a game. A preset topic is picked by its name. */
export interface HostChoices {
  topic?: string
  /** Typed instead of picking a preset. */
  customTopic?: string
  /** These three are the host's saved settings. */
  count?: number
  difficulty?: Difficulty
  translate?: boolean
}

/** Picks the topic on the "Create a game" screen, which shows the saved settings. */
export async function chooseTopic(device: ReturnType<typeof open>, user: User, choices: HostChoices = {}) {
  if (choices.customTopic !== undefined) {
    await user.type(device.ui.getByLabelText('Or enter your own topic'), choices.customTopic)
  } else {
    await user.click(device.ui.getByRole('button', { name: choices.topic ?? 'Greetings and small talk' }))
  }
}

/**
 * A device that creates a game, speaking German (so learning English), with the topic and options in `choices`
 * (a preset topic and the default options unless said otherwise). Resolves once the code is shown.
 * It gets a generator that answers at once; pass `null` for a build without AI.
 */
export async function createGame(
  network: MemoryNetwork,
  user: User,
  generator: SentenceGenerator | null = instantGenerator().generator,
  choices: HostChoices = {},
) {
  const { count, difficulty, translate } = choices
  const options = {
    count: count ?? DEFAULT_ROUND_OPTIONS.count,
    difficulty: difficulty ?? DEFAULT_ROUND_OPTIONS.difficulty,
    translate: translate ?? DEFAULT_ROUND_OPTIONS.translate,
  }
  const device = open(network, generator ?? undefined, { ...SAVED_DEFAULTS, options })
  await user.click(device.ui.getByRole('button', { name: '2 players' }))
  await user.click(device.ui.getByRole('button', { name: 'Create a game' }))
  await chooseTopic(device, user, choices)
  await user.click(device.ui.getByRole('button', { name: 'Create game' }))
  const code = (await device.ui.findByText(/^[A-Z2-9]{5}$/)).textContent ?? ''
  return { ...device, code }
}

export async function startJoining(network: MemoryNetwork, user: User, code: string) {
  const device = open(network)
  await user.click(device.ui.getByRole('button', { name: '2 players' }))
  await user.click(device.ui.getByRole('button', { name: 'Join a game' }))
  await user.type(device.ui.getByLabelText('Game code'), code)
  await user.click(device.ui.getByRole('button', { name: 'Join game' }))
  return device
}

/** A device that joins, ending on the "waiting for the host" screen. It learns German, because the host learns English. */
export const joinGame = startJoining

export const sentenceOn = (device: { container: HTMLElement }) =>
  device.container.querySelector('.sentence')?.textContent


/** Both players tell the game that their own sentences are fine, which starts the round. */
export async function confirmSentences(host: ReturnType<typeof open>, guest: ReturnType<typeof open>, user: User) {
  await user.click(await host.ui.findByRole('button', { name: 'Looks good' }))
  await user.click(await guest.ui.findByRole('button', { name: 'Looks good' }))
}

/** Both players review the sentences, which the host's topic already asked for, and confirm them. */
export const startRound = confirmSentences

/** The host's screen once the partner has joined and the sentences have been asked for. */
export const reviewing = (host: ReturnType<typeof open>) => host.ui.findByRole('heading', { name: 'Review your sentences' })
