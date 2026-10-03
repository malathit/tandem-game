import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import type { SentenceGenerator } from '../generation/generator'
import type { Difficulty } from '../generation/types'
import { OnlineGame } from '../components/OnlineGame'
import { instantGenerator } from './generators'
import type { MemoryNetwork } from './memoryNetwork'

export const languages: Language[] = staticSource.getLanguages()

export type User = ReturnType<typeof userEvent.setup>

export function open(network: MemoryNetwork, generator?: SentenceGenerator) {
  const view = render(<OnlineGame network={network} languages={languages} generator={generator} />)
  return { ...view, ui: within(view.container) }
}

/** The label of the step the screen says we are on. */
export const currentStep = (device: { container: HTMLElement }) =>
  device.container.querySelector('[aria-current="step"]')?.textContent

/** What the host sets before the invite link exists. A preset topic is picked by its name. */
export interface HostChoices {
  topic?: string
  /** Typed instead of picking a preset. */
  customTopic?: string
  count?: number
  difficulty?: Difficulty
  translate?: boolean
}

/** Fills in the topic and round options on the "Create a game" screen. */
export async function chooseRound(device: ReturnType<typeof open>, user: User, choices: HostChoices = {}) {
  if (choices.count !== undefined) {
    await user.selectOptions(device.ui.getByLabelText('Sentences per player'), String(choices.count))
  }
  if (choices.difficulty !== undefined) await user.selectOptions(device.ui.getByLabelText('Difficulty'), choices.difficulty)
  if (choices.translate) await user.click(device.ui.getByLabelText('Show the translation after each turn'))
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
  const device = open(network, generator ?? undefined)
  await user.click(device.ui.getByRole('button', { name: 'Create a game' }))
  await user.selectOptions(device.ui.getByLabelText('I speak'), 'de')
  await chooseRound(device, user, choices)
  await user.click(device.ui.getByRole('button', { name: 'Create game' }))
  const code = (await device.ui.findByText(/^[A-Z2-9]{5}$/)).textContent ?? ''
  return { ...device, code }
}

export async function startJoining(network: MemoryNetwork, user: User, code: string) {
  const device = open(network)
  await user.click(device.ui.getByRole('button', { name: 'Join a game' }))
  await user.type(device.ui.getByLabelText('Game code'), code)
  await user.click(device.ui.getByRole('button', { name: 'Join game' }))
  return device
}

/** A device that joins and picks English (so it learns German), ending on the "waiting for the host" screen. */
export async function joinGame(network: MemoryNetwork, user: User, code: string) {
  const device = await startJoining(network, user, code)
  await user.selectOptions(await device.ui.findByLabelText('I speak'), 'en')
  await user.click(device.ui.getByRole('button', { name: 'Continue' }))
  return device
}

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
