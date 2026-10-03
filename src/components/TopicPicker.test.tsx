import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Topic } from '../content/types'
import { TopicPicker } from './TopicPicker'

const topics: Topic[] = [
  { id: 'modal-verbs', name: 'Modal verbs' },
  { id: 'conjunctions', name: 'Conjunctions' },
]

function setup(props: { topics?: Topic[] } = {}) {
  const onSelect = vi.fn()
  const user = userEvent.setup()
  render(<TopicPicker topics={props.topics ?? topics} onSelect={onSelect} />)
  return {
    user,
    onSelect,
    input: screen.getByLabelText('Or enter your own topic'),
    useButton: screen.getByRole('button', { name: 'Use this topic' }),
  }
}

describe('TopicPicker', () => {
  it('shows a button for each preset topic', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Modal verbs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conjunctions' })).toBeInTheDocument()
  })

  it('reports the id of a preset topic when it is clicked', async () => {
    const { user, onSelect } = setup()
    await user.click(screen.getByRole('button', { name: 'Conjunctions' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('conjunctions')
  })

  it('says so when the language pair has no preset topics but still allows a custom one', async () => {
    const { user, onSelect, input } = setup({ topics: [] })
    expect(screen.getByText(/no topics/i)).toBeInTheDocument()
    await user.type(input, 'Weather{Enter}')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('Weather')
  })

  it('disables the custom topic button while the input is blank or only spaces', async () => {
    const { user, onSelect, input, useButton } = setup()
    expect(useButton).toBeDisabled()
    await user.type(input, '   ')
    expect(useButton).toBeDisabled()
    await user.type(input, '{Enter}')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('reports a trimmed custom topic', async () => {
    const { user, onSelect, input, useButton } = setup()
    await user.type(input, '  Food and drink  ')
    expect(useButton).toBeEnabled()
    await user.click(useButton)
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('Food and drink')
  })

  it('limits the length of a custom topic', () => {
    const { input } = setup()
    expect(input).toHaveAttribute('maxlength', '60')
  })
})
