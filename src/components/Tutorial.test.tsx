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
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('walks to the last step and back', async () => {
    const { user, onDone } = setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'On your own or with a partner' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Welcome to Tandem Game' })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('ends on the settings, with no way to skip what is already the last step', async () => {
    const { user, onDone } = setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByRole('button', { name: 'Skip tutorial' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose my languages' }))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('can be skipped from the first step', async () => {
    const { user, onDone } = setup()
    await user.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
