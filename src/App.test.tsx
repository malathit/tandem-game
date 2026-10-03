import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryNetwork } from './test/memoryNetwork'

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
