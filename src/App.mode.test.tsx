import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryNetwork } from './test/memoryNetwork'

describe('choosing how to play', () => {
  it('starts by asking whether to play on one device or two', () => {
    render(<App network={createMemoryNetwork()} />)
    expect(screen.getByRole('heading', { name: 'How do you want to play?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play on this device' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play on two devices' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Progress' })).not.toBeInTheDocument()
  })

  it('can go back to the start from one-device play', async () => {
    const user = userEvent.setup()
    render(<App network={createMemoryNetwork()} />)
    await user.click(screen.getByRole('button', { name: 'Play on this device' }))
    expect(screen.getByRole('navigation', { name: 'Progress' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to start' }))
    expect(screen.getByRole('button', { name: 'Play on two devices' })).toBeInTheDocument()
  })

  it('goes back to the start from the same screen after choosing languages', async () => {
    const user = userEvent.setup()
    render(<App network={createMemoryNetwork()} />)
    await user.click(screen.getByRole('button', { name: 'Play on this device' }))
    await user.selectOptions(screen.getByLabelText('Player 1 is learning'), 'en')
    await user.selectOptions(screen.getByLabelText('Player 2 is learning'), 'de')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Back to start' }))

    await user.click(screen.getByRole('button', { name: 'Play on this device' }))
    expect(screen.getByLabelText('Player 1 is learning')).toHaveDisplayValue('Choose a language')
  })

  it('opens two-device play and can return to the start', async () => {
    const user = userEvent.setup()
    render(<App network={createMemoryNetwork()} />)
    await user.click(screen.getByRole('button', { name: 'Play on two devices' }))
    expect(screen.getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join a game' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Play on this device' })).toBeInTheDocument()
  })
})
