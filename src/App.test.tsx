import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { SAVED_DEFAULTS } from './test/devices'
import { saveHostDefaults } from './game/hostPreferences'
import { createMemoryNetwork } from './test/memoryNetwork'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('opens on the tutorial the first time, then the settings, then on the choice between playing alone and with a partner', async () => {
    const user = userEvent.setup()
    render(<App network={createMemoryNetwork()} />)
    expect(screen.getByRole('heading', { name: 'Welcome to Tandem Game' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('I speak'), 'de')
    await user.selectOptions(screen.getByLabelText("I'm learning"), 'en')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(screen.getByRole('button', { name: '1 player' })).toBeInTheDocument()
  })

  it('opens on the choice between playing alone and with a partner once the settings are saved', () => {
    saveHostDefaults(SAVED_DEFAULTS)
    render(<App network={createMemoryNetwork()} />)
    expect(screen.getByRole('heading', { name: 'Tandem Game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 player' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 players' })).toBeInTheDocument()
  })

  it('has a title that links to the site root, so clicking it reloads the page', () => {
    render(<App network={createMemoryNetwork()} />)
    expect(screen.getByRole('link', { name: 'Tandem Game' })).toHaveAttribute('href', '/')
  })

  it('no longer offers to play on one device', () => {
    saveHostDefaults(SAVED_DEFAULTS)
    render(<App network={createMemoryNetwork()} />)
    expect(screen.queryByRole('button', { name: /this device/i })).not.toBeInTheDocument()
  })
})

describe('opening an invite link', () => {
  it('tries to join the game in the link and removes the code from the address bar', async () => {
    window.history.replaceState(null, '', '/?join=999999')
    render(<App network={createMemoryNetwork()} />)

    // No such game exists on the fake network, which proves the code was used.
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't find a game/i)
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/')
  })

  it('ignores a code that cannot be valid and shows the normal start screen', () => {
    saveHostDefaults(SAVED_DEFAULTS)
    window.history.replaceState(null, '', '/?join=abc')
    render(<App network={createMemoryNetwork()} />)

    expect(screen.getByRole('button', { name: '2 players' })).toBeInTheDocument()
    expect(window.location.search).toBe('?join=abc')
  })
})
