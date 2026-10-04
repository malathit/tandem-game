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
    await user.type(input, ' 482-913 {Enter}')
    expect(onJoin).toHaveBeenCalledExactlyOnceWith('482913')
  })

  it('shows the code without spaces or dashes as it is typed', async () => {
    const { user, input } = setup()
    await user.type(input, '48 2-9')
    expect(input).toHaveValue('4829')
  })

  it('counts the characters typed so far', async () => {
    const { user, input } = setup()
    expect(screen.getByText('0 of 6 digits typed.')).toBeInTheDocument()
    await user.type(input, '482')
    expect(screen.getByText('3 of 6 digits typed.')).toBeInTheDocument()
  })

  it('explains when the code cannot be right and does not join', async () => {
    const { user, input, onJoin } = setup()
    await user.type(input, '123{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(/6 digits/i)
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('clears the warning once the code is corrected', async () => {
    const { user, input } = setup()
    await user.type(input, 'abc{Enter}')
    await user.clear(input)
    await user.type(input, '482913')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not submit an empty code', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Join game' })).toBeDisabled()
  })
})
