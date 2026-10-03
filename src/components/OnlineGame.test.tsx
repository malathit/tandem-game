import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  chooseRound,
  confirmSentences,
  createGame,
  currentStep,
  joinGame,
  languages,
  open,
  reviewing,
  sentenceOn,
  startJoining,
  startRound,
} from '../test/devices'
import { english, german } from '../test/generators'
import { createMemoryNetwork } from '../test/memoryNetwork'
import { OnlineGame } from './OnlineGame'

describe('OnlineGame menu', () => {
  it('offers to create or join a game', () => {
    const { ui } = open(createMemoryNetwork())
    expect(ui.getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
    expect(ui.getByRole('button', { name: 'Join a game' })).toBeInTheDocument()
    expect(ui.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it.each([
    ['Create a game', 'Create game'],
    ['Join a game', 'Join game'],
  ])('can go back to the menu from "%s"', async (menuButton, formButton) => {
    const user = userEvent.setup()
    const { ui } = open(createMemoryNetwork())
    await user.click(ui.getByRole('button', { name: menuButton }))
    expect(ui.getByRole('button', { name: formButton })).toBeInTheDocument()

    await user.click(ui.getByRole('button', { name: 'Back' }))
    expect(ui.getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
  })
})

describe('playing a whole round on two devices', () => {
  it('keeps both devices in step and only lets the player whose turn it is move on', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    expect(await host.ui.findByText(/waiting for your partner to join/i)).toBeInTheDocument()

    const guest = await joinGame(network, user, host.code)
    await reviewing(host)
    expect(await guest.ui.findByRole('heading', { name: 'Review your sentences' })).toBeInTheDocument()
    expect(host.ui.getByText('You are learning English')).toBeInTheDocument()
    expect(host.ui.getByText('Your partner is learning German')).toBeInTheDocument()
    expect(guest.ui.getByText('You are learning German')).toBeInTheDocument()
    expect(guest.ui.getByText('Your partner is learning English')).toBeInTheDocument()

    await startRound(host, guest, user)
    await host.ui.findByText('Turn 1 of 4')
    await guest.ui.findByText('Turn 1 of 4')

    // Player 1 (host) reads a German sentence; the partner sees the same one.
    expect(german).toContain(sentenceOn(host))
    expect(sentenceOn(guest)).toBe(sentenceOn(host))
    expect(guest.ui.queryByRole('button', { name: /next turn/i })).not.toBeInTheDocument()
    expect(guest.ui.getByRole('status')).toHaveTextContent('Waiting for your partner')

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
    expect(english).toContain(sentenceOn(guest))
    await user.click(guest.ui.getByRole('button', { name: 'Finish round' }))
    await host.ui.findByRole('heading', { name: 'Round complete' })
    await guest.ui.findByRole('heading', { name: 'Round complete' })
    expect(guest.ui.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
    expect(guest.ui.getByText(/waiting for the host to start another round/i)).toBeInTheDocument()

    await user.click(host.ui.getByRole('button', { name: 'Play again' }))
    await confirmSentences(host, guest, user)
    await host.ui.findByText('Turn 1 of 4')
    await guest.ui.findByText('Turn 1 of 4')
  })

  it('lets the host go back to choose another topic', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user, undefined, { topic: 'Weather' })
    const guest = await joinGame(network, user, host.code)
    await startRound(host, guest, user)
    await guest.ui.findByText('Turn 1 of 4')

    await user.click(host.ui.getByRole('button', { name: 'Change topic' }))
    await host.ui.findByRole('button', { name: 'Greetings and small talk' })
    await guest.ui.findByText(/waiting for the host to choose a topic/i)
  })

  it('says AI is not available, and keeps the guest waiting, in a build without it', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user, null)
    const guest = await joinGame(network, user, host.code)

    expect(await host.ui.findByRole('alert')).toHaveTextContent(/AI sentences aren't available/i)
    expect(host.ui.queryByRole('button', { name: 'Greetings and small talk' })).not.toBeInTheDocument()
    // The host did choose a topic, so the guest is told the sentences could not be written, not that the host has to choose.
    expect(await guest.ui.findByRole('alert')).toHaveTextContent(/can't be reached/i)
    expect(guest.ui.queryByText(/waiting for the host to choose a topic/i)).not.toBeInTheDocument()
    expect(guest.ui.queryByRole('button', { name: 'Looks good' })).not.toBeInTheDocument()
  })
})

describe('invite links', () => {
  it('shows the host a link that carries the game code', async () => {
    const user = userEvent.setup()
    const host = await createGame(createMemoryNetwork(), user)
    expect(host.ui.getByLabelText('Invite link')).toHaveDisplayValue(new RegExp(`\\?join=${host.code}$`))
    expect(host.ui.getByRole('button', { name: 'Copy invite link' })).toBeInTheDocument()
  })

  it('joins straight away when opened with a code, then asks for the language', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)

    const view = render(<OnlineGame network={network} languages={languages} initialCode={host.code} />)
    const guest = within(view.container)
    await user.selectOptions(await guest.findByLabelText('I am learning'), 'de')
    await user.click(guest.getByRole('button', { name: 'Continue' }))
    await reviewing(host)
  })

  it('starts on the menu when there is no code', () => {
    const view = render(<OnlineGame network={createMemoryNetwork()} languages={languages} />)
    expect(within(view.container).getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
  })
})

describe('joining announcements', () => {
  it('tells the host their partner has joined, and keeps saying so until the partner picks a language', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    expect(host.ui.getByLabelText('Invite link')).toBeInTheDocument()

    const guest = await startJoining(network, user, host.code)

    expect(await host.ui.findByRole('heading', { name: /your partner has joined/i })).toBeInTheDocument()
    expect(host.ui.getByText(/waiting for them to choose their language/i)).toBeInTheDocument()
    expect(host.ui.queryByLabelText('Invite link')).not.toBeInTheDocument()

    await user.selectOptions(await guest.ui.findByLabelText('I am learning'), 'de')
    await user.click(guest.ui.getByRole('button', { name: 'Continue' }))
    await reviewing(host)
    expect(host.ui.queryByRole('heading', { name: /has joined/i })).not.toBeInTheDocument()
  })

  it('shows the host the invite again if the partner drops before choosing a language', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await startJoining(network, user, host.code)
    await host.ui.findByRole('heading', { name: /your partner has joined/i })

    await user.click(guest.ui.getByRole('button', { name: 'Leave game' }))
    expect(await host.ui.findByLabelText('Invite link')).toBeInTheDocument()
    expect(host.ui.queryByRole('heading', { name: /has joined/i })).not.toBeInTheDocument()
  })

  it('takes the guest straight to the language picker with a banner saying they have joined', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await startJoining(network, user, host.code)

    expect(await guest.ui.findByLabelText('I am learning')).toBeInTheDocument()
    expect(guest.ui.getByRole('status')).toHaveTextContent(/you've joined the room/i)
  })
})

describe('progress steps', () => {
  it('move from Connect to Review to Play on both devices', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    expect(currentStep(host)).toBe('Connect')

    const guest = await startJoining(network, user, host.code)
    await guest.ui.findByLabelText('I am learning')
    expect(currentStep(guest)).toBe('Connect')

    await user.selectOptions(guest.ui.getByLabelText('I am learning'), 'de')
    await user.click(guest.ui.getByRole('button', { name: 'Continue' }))
    await reviewing(host)
    await guest.ui.findByRole('heading', { name: 'Review your sentences' })
    expect(currentStep(host)).toBe('Review')
    expect(currentStep(guest)).toBe('Review')

    await startRound(host, guest, user)
    await guest.ui.findByText('Turn 1 of 4')
    expect(currentStep(host)).toBe('Play')
    expect(currentStep(guest)).toBe('Play')
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
    await reviewing(host)

    const intruder = await startJoining(network, user, host.code)
    expect(await intruder.ui.findByRole('alert')).toHaveTextContent(/connection .* lost/i)
    expect(host.ui.getByRole('heading', { name: 'Review your sentences' })).toBeInTheDocument()
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
    await chooseRound(device, user)
    await user.click(device.ui.getByRole('button', { name: 'Create game' }))

    expect(await device.ui.findByRole('alert')).toHaveTextContent(/couldn't (open|reach)/i)
  })

  it('lets a partner who dropped rejoin and pick up where the game was', async () => {
    const user = userEvent.setup()
    const network = createMemoryNetwork()
    const host = await createGame(network, user)
    const guest = await joinGame(network, user, host.code)
    await startRound(host, guest, user)
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
    await reviewing(host)

    await user.click(host.ui.getByRole('button', { name: 'Leave game' }))
    expect(host.ui.getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
    expect(await guest.ui.findByRole('alert')).toHaveTextContent(/connection .* lost/i)
  })
})
