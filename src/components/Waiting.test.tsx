import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SLOW_AFTER_MS, Waiting } from './Waiting'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Waiting', () => {
  it('says what it waits for, as a status', () => {
    render(<Waiting>Connecting…</Waiting>)
    expect(screen.getByRole('status')).toHaveTextContent('Connecting…')
  })

  it('stays quiet at first, then explains and offers a way out once it is slow', () => {
    render(
      <Waiting slow="Taking a while." actions={<button type="button">Give up</button>}>
        Connecting…
      </Waiting>,
    )
    expect(screen.queryByText('Taking a while.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Give up' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(SLOW_AFTER_MS))
    expect(screen.getByText('Taking a while.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give up' })).toBeInTheDocument()
  })

  it('has nothing more to say when no slow message is given', () => {
    render(<Waiting>Connecting…</Waiting>)
    act(() => vi.advanceTimersByTime(SLOW_AFTER_MS))
    expect(screen.getByRole('status').querySelectorAll('p')).toHaveLength(1)
  })

  it('stops counting once it is gone', () => {
    const { unmount } = render(<Waiting slow="Taking a while.">Connecting…</Waiting>)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
