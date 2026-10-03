import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import { createMemoryNetwork, type MemoryNetwork } from '../test/memoryNetwork'
import { OnlineGame } from './OnlineGame'

const languages: Language[] = staticSource.getLanguages()

type User = ReturnType<typeof userEvent.setup>

function open(network: MemoryNetwork, onExit = vi.fn()) {
  const view = render(<OnlineGame network={network} languages={languages} onExit={onExit} />)
  return { ...view, ui: within(view.container), onExit }
}

/** A device that creates a game, learning English. Resolves once the code is shown. */
async function createGame(network: MemoryNetwork, user: User) {
  const device = open(network)
  await user.click(device.ui.getByRole('button', { name: 'Create a game' }))
  await user.selectOptions(device.ui.getByLabelText('I am learning'), 'en')
  await user.click(device.ui.getByRole('button', { name: 'Create game' }))
  const code = (await device.ui.findByText(/^[A-Z2-9]{5}$/)).textContent ?? ''
  return { ...device, code }
}

async function startJoining(network: MemoryNetwork, user: User, code: string) {
  const device = open(network)
  await user.click(device.ui.getByRole('button', { name: 'Join a game' }))
  await user.type(device.ui.getByLabelText('Game code'), code)
  await user.click(device.ui.getByRole('button', { name: 'Join game' }))
  return device
}

/** A device that joins and picks German, ending on the "waiting for the host" screen. */
async function joinGame(network: MemoryNetwork, user: User, code: string) {
  const device = await startJoining(network, user, code)
  await user.selectOptions(await device.ui.findByLabelText('I am learning'), 'de')
  await user.click(device.ui.getByRole('button', { name: 'Continue' }))
  return device
}

const sentenceOn = (device: { container: HTMLElement }) =>
  device.container.querySelector('.sentence')?.textContent

describe('OnlineGame menu', () => {
  it('offers to create or join a game and can go back', async () => {
    const user = userEvent.setup()
    const { ui, onExit } = open(createMemoryNetwork())
    expect(ui.getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
    expect(ui.getByRole('button', { name: 'Join a game' })).toBeInTheDocument()
    await user.click(ui.getByRole('button', { name: 'Back' }))
    expect(onExit).toHaveBeenCalledOnce()
  })
})

describe('playing a whole round on two devices', () => {
  it('keeps both devices in step and only lets the player whose turn it is move on', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    expect(await host.ui.findByText(/waiting for your partner to join/i)).toBeInTheDocument()

    const guest = await joinGame(network, user, host.code)
    await host.ui.findByRole('button', { name: 'Modal verbs' })
    expect(await guest.ui.findByText(/waiting for the host to choose a topic/i)).toBeInTheDocument()
    expect(host.ui.getByText(/Player 2 is learning German/)).toBeInTheDocument()
    expect(guest.ui.getByText(/Player 2 is learning German \(you\)/)).toBeInTheDocument()

    await user.click(host.ui.getByRole('button', { name: 'Modal verbs' }))
    await host.ui.findByText('Turn 1 of 4')
    await guest.ui.findByText('Turn 1 of 4')

    // Player 1 (host) reads a German sentence; the partner sees the same one.
    const germanModals = staticSource.getSentences('de', 'modal-verbs').map((s) => s.text)
    expect(germanModals).toContain(sentenceOn(host))
    expect(sentenceOn(guest)).toBe(sentenceOn(host))
    expect(guest.ui.queryByRole('button', { name: /next turn/i })).not.toBeInTheDocument()
    expect(guest.ui.getByRole('status')).toHaveTextContent('Waiting for Player 1')

    for (const [turn, mover, other] of [
      [1, host, guest],
      [2, guest, host],
      [3, host, guest],
    ] as const) {
      await user.click(mover.ui.getByRole('button', { name: 'Next turn' }))
      await other.ui.findByText(`Turn ${turn + 1} of 4`)
      await mover.ui.findByText(`Turn ${turn + 1} of 4`)
      expect(mover.ui.queryByRole('button', { name: /next turn|finish/i })).not.toBeInTheDocument()
      expect(other.ui.getByRole('button', { name: /next turn|finish/i })).toBeInTheDocument()
    }

    // Player 2 (guest) reads English and finishes the round.
    const englishModals = staticSource.getSentences('en', 'modal-verbs').map((s) => s.text)
    expect(englishModals).toContain(sentenceOn(guest))
    await user.click(guest.ui.getByRole('button', { name: 'Finish round' }))
    await host.ui.findByRole('heading', { name: 'Round complete' })
    await guest.ui.findByRole('heading', { name: 'Round complete' })
    expect(guest.ui.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
    expect(guest.ui.getByText(/waiting for the host to start another round/i)).toBeInTheDocument()

    await user.click(host.ui.getByRole('button', { name: 'Play again' }))
    await host.ui.findByText('Turn 1 of 4')
    await guest.ui.findByText('Turn 1 of 4')
  })

  it('lets the host go back to choose another topic', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await joinGame(network, user, host.code)
    await user.click(await host.ui.findByRole('button', { name: 'Conjunctions' }))
    await guest.ui.findByText('Turn 1 of 4')

    await user.click(host.ui.getByRole('button', { name: 'Change topic' }))
    await host.ui.findByRole('button', { name: 'Modal verbs' })
    await guest.ui.findByText(/waiting for the host to choose a topic/i)
  })

  it('tells the host when a topic has no sentences and keeps the guest waiting', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await joinGame(network, user, host.code)
    await host.ui.findByRole('button', { name: 'Modal verbs' })

    await user.type(host.ui.getByLabelText('Or enter your own topic'), 'Weather{Enter}')
    expect(await host.ui.findByText(/no sentences yet for .?Weather/i)).toBeInTheDocument()
    expect(guest.ui.getByText(/waiting for the host to choose a topic/i)).toBeInTheDocument()
  })
})

describe('joining', () => {
  it("does not offer the guest the language the host is already learning", async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await startJoining(network, user, host.code)

    const select = await guest.ui.findByLabelText('I am learning')
    expect(guest.ui.getByText(/your partner is learning English/i)).toBeInTheDocument()
    expect(within(select).queryByRole('option', { name: 'English' })).not.toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'German' })).toBeInTheDocument()
  })

  it('says so when there is no game with that code', async () => {
    const user = userEvent.setup()
    const guest = await startJoining(createMemoryNetwork(), user, 'ZZZZ9')
    expect(await guest.ui.findByRole('alert')).toHaveTextContent(/couldn't find a game with that code/i)

    await user.click(guest.ui.getByRole('button', { name: 'Enter a different code' }))
    expect(guest.ui.getByLabelText('Game code')).toBeInTheDocument()
  })

  it('turns away a third device while the guest is connected', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    await joinGame(network, user, host.code)
    await host.ui.findByRole('button', { name: 'Modal verbs' })

    const intruder = await startJoining(network, user, host.code)
    expect(await intruder.ui.findByRole('alert')).toHaveTextContent(/connection .* lost/i)
    expect(host.ui.getByRole('button', { name: 'Modal verbs' })).toBeInTheDocument()
  })
})

describe('connection problems', () => {
  it('reports that the game service cannot be reached when creating a game', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    network.unavailable = true
    const device = open(network)
    await user.click(device.ui.getByRole('button', { name: 'Create a game' }))
    await user.selectOptions(device.ui.getByLabelText('I am learning'), 'en')
    await user.click(device.ui.getByRole('button', { name: 'Create game' }))

    expect(await device.ui.findByRole('alert')).toHaveTextContent(/couldn't (open|reach)/i)
  })

  it('lets a partner who dropped rejoin and pick up where the game was', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await joinGame(network, user, host.code)
    await user.click(await host.ui.findByRole('button', { name: 'Modal verbs' }))
    await user.click(await host.ui.findByRole('button', { name: 'Next turn' }))
    await guest.ui.findByText('Turn 2 of 4')

    guest.unmount()
    expect(await host.ui.findByText(/partner is disconnected/i)).toBeInTheDocument()

    const returning = await startJoining(network, user, host.code)
    await returning.ui.findByText('Turn 2 of 4')
    expect(returning.ui.getByRole('button', { name: 'Next turn' })).toBeInTheDocument()
    await waitFor(() => expect(host.ui.queryByText(/partner is disconnected/i)).not.toBeInTheDocument())
  })

  it('tells the guest when the host leaves', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await joinGame(network, user, host.code)
    await host.ui.findByRole('button', { name: 'Modal verbs' })

    await user.click(host.ui.getByRole('button', { name: 'Leave game' }))
    expect(host.onExit).toHaveBeenCalledOnce()
    host.unmount() // the app does this when it leaves two-device play
    expect(await guest.ui.findByRole('alert')).toHaveTextContent(/connection .* lost/i)
  })
})
