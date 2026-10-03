import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryNetwork } from './test/memoryNetwork'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('opens on the choice between playing alone and with a partner', () => {
    render(<App network={createMemoryNetwork()} />)
    expect(screen.getByRole('heading', { name: 'Tandem Game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 player' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 players' })).toBeInTheDocument()
  })

  it('no longer offers to play on one device', () => {
    render(<App network={createMemoryNetwork()} />)
    expect(screen.queryByRole('button', { name: /this device/i })).not.toBeInTheDocument()
  })
})

describe('opening an invite link', () => {
  it('tries to join the game in the link and removes the code from the address bar', async () => {
    window.history.replaceState(null, '', '/?join=ZZZZ9')
    render(<App network={createMemoryNetwork()} />)

    // No such game exists on the fake network, which proves the code was used.
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't find a game/i)
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/')
  })

  it('ignores a code that cannot be valid and shows the normal start screen', () => {
    window.history.replaceState(null, '', '/?join=abc')
    render(<App network={createMemoryNetwork()} />)

    expect(screen.getByRole('button', { name: '2 players' })).toBeInTheDocument()
    expect(window.location.search).toBe('?join=abc')
  })
})
