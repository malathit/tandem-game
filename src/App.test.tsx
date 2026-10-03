import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryNetwork } from './test/memoryNetwork'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('opens straight on creating or joining a game', () => {
    render(<App network={createMemoryNetwork()} />)
    expect(screen.getByRole('heading', { name: 'Tandem Game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join a game' })).toBeInTheDocument()
  })

  it('no longer offers to play on one device', () => {
    render(<App network={createMemoryNetwork()} />)
    expect(screen.queryByRole('button', { name: /this device/i })).not.toBeInTheDocument()
  })
})

describe('opening an invite link', () => {
  it('tries to join the game in the link and removes the code from the address bar', async () => {
    window.history.replaceState(null, '', '/tandem-game/?join=ZZZZ9')
    render(<App network={createMemoryNetwork()} />)

    // No such game exists on the fake network, which proves the code was used.
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't find a game/i)
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/tandem-game/')
  })

  it('ignores a code that cannot be valid and shows the normal start screen', () => {
    window.history.replaceState(null, '', '/tandem-game/?join=abc')
    render(<App network={createMemoryNetwork()} />)

    expect(screen.getByRole('button', { name: 'Create a game' })).toBeInTheDocument()
    expect(window.location.search).toBe('?join=abc')
  })
})
