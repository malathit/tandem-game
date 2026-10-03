import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JoinForm } from './JoinForm'

function setup() {
  const onJoin = vi.fn()
  render(<JoinForm onJoin={onJoin} />)
  return { onJoin, user: userEvent.setup(), input: screen.getByLabelText('Game code') }
}

describe('JoinForm', () => {
  it('joins with a cleaned-up code', async () => {
    const { user, input, onJoin } = setup()
    await user.type(input, ' k7q-xz {Enter}')
    expect(onJoin).toHaveBeenCalledExactlyOnceWith('K7QXZ')
  })

  it('explains when the code cannot be right and does not join', async () => {
    const { user, input, onJoin } = setup()
    await user.type(input, 'abc{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(/5 characters/i)
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('clears the warning once the code is corrected', async () => {
    const { user, input } = setup()
    await user.type(input, 'abc{Enter}')
    await user.clear(input)
    await user.type(input, 'K7QXZ')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not submit an empty code', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Join game' })).toBeDisabled()
  })
})
