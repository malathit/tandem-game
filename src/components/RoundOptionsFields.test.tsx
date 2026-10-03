import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_ROUND_OPTIONS, type RoundOptions } from '../generation/types'
import { RoundOptionsFields } from './RoundOptionsFields'

function setup(options: RoundOptions = DEFAULT_ROUND_OPTIONS) {
  const onChange = vi.fn()
  render(<RoundOptionsFields options={options} onChange={onChange} />)
  return { user: userEvent.setup(), onChange }
}

describe('RoundOptionsFields', () => {
  it('starts with two sentences, medium difficulty and no translations', () => {
    setup()
    expect(screen.getByLabelText('Sentences per player')).toHaveValue('2')
    expect(screen.getByLabelText('Difficulty')).toHaveValue('medium')
    expect(screen.getByLabelText('Show the translation after each turn')).not.toBeChecked()
  })

  it('offers one to five sentences per player', () => {
    setup()
    const counts = within(screen.getByLabelText('Sentences per player')).getAllByRole('option')
    expect(counts.map((option) => option.textContent)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('offers easy, medium and hard', () => {
    setup()
    const levels = within(screen.getByLabelText('Difficulty')).getAllByRole('option')
    expect(levels.map((option) => [option.textContent, option.getAttribute('value')])).toEqual([
      ['Easy', 'easy'],
      ['Medium', 'medium'],
      ['Hard', 'hard'],
    ])
  })

  it('shows the options it is given', () => {
    setup({ count: 3, translate: true, difficulty: 'hard' })
    expect(screen.getByLabelText('Sentences per player')).toHaveValue('3')
    expect(screen.getByLabelText('Difficulty')).toHaveValue('hard')
    expect(screen.getByLabelText('Show the translation after each turn')).toBeChecked()
  })

  it('reports a new number of sentences, keeping the other choices', async () => {
    const { user, onChange } = setup({ count: 2, translate: true, difficulty: 'easy' })
    await user.selectOptions(screen.getByLabelText('Sentences per player'), '5')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ count: 5, translate: true, difficulty: 'easy' })
  })

  it('reports a new difficulty, keeping the other choices', async () => {
    const { user, onChange } = setup({ count: 4, translate: false, difficulty: 'medium' })
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'hard')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ count: 4, translate: false, difficulty: 'hard' })
  })

  it('reports turning translations on, keeping the other choices', async () => {
    const { user, onChange } = setup({ count: 4, translate: false, difficulty: 'hard' })
    await user.click(screen.getByLabelText('Show the translation after each turn'))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ count: 4, translate: true, difficulty: 'hard' })
  })
})
