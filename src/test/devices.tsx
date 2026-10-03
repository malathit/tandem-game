import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import type { SentenceGenerator } from '../generation/generator'
import { OnlineGame } from '../components/OnlineGame'
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

/** A device that creates a game, learning English. Resolves once the code is shown. */
export async function createGame(network: MemoryNetwork, user: User, generator?: SentenceGenerator) {
  const device = open(network, generator)
  await user.click(device.ui.getByRole('button', { name: 'Create a game' }))
  await user.selectOptions(device.ui.getByLabelText('I am learning'), 'en')
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

/** A device that joins and picks German, ending on the "waiting for the host" screen. */
export async function joinGame(network: MemoryNetwork, user: User, code: string) {
  const device = await startJoining(network, user, code)
  await user.selectOptions(await device.ui.findByLabelText('I am learning'), 'de')
  await user.click(device.ui.getByRole('button', { name: 'Continue' }))
  return device
}

export const sentenceOn = (device: { container: HTMLElement }) =>
  device.container.querySelector('.sentence')?.textContent

