import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tutorial } from './Tutorial'

function setup() {
  const onDone = vi.fn()
  render(<Tutorial onDone={onDone} />)
  return { user: userEvent.setup(), onDone }
}

describe('Tutorial', () => {
  it('starts with a welcome and nothing to go back to', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Welcome to Tandem Game' })).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('walks through the steps and back', async () => {
    const { user, onDone } = setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'How a round works' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Playing with a partner' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'How a round works' })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('ends on the settings, with no way to skip what is already the last step', async () => {
    const { user, onDone } = setup()
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'First, your settings' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip tutorial' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set my settings' }))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('can be skipped from any earlier step', async () => {
    const { user, onDone } = setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
