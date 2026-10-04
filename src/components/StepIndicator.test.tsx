import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepIndicator } from './StepIndicator'

describe('StepIndicator', () => {
  it('lists the three steps in order', () => {
    render(<StepIndicator current={1} />)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Connect',
      'Sentences',
      'Play',
    ])
  })

  it.each([
    [1, 'Connect'],
    [2, 'Sentences'],
    [3, 'Play'],
  ] as const)('marks only step %i as the current one', (current, label) => {
    render(<StepIndicator current={current} />)
    const marked = screen.getAllByRole('listitem').filter((item) => item.hasAttribute('aria-current'))
    expect(marked.map((item) => item.textContent)).toEqual([label])
    expect(marked[0]).toHaveAttribute('aria-current', 'step')
  })

  it('can list other steps, for a game with no partner', () => {
    render(<StepIndicator current={2} steps={['Sentences', 'Play']} />)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Sentences', 'Play'])
    expect(screen.getByText('Play')).toHaveAttribute('aria-current', 'step')
  })

  it('is announced as progress navigation', () => {
    render(<StepIndicator current={2} />)
    expect(screen.getByRole('navigation', { name: 'Progress' })).toBeInTheDocument()
  })
})
