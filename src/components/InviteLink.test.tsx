import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InviteLink } from './InviteLink'

const url = 'https://tandem-game.github.io/?join=K7QXZ'

function setup() {
  const user = userEvent.setup() // also installs a clipboard stand-in
  render(<InviteLink url={url} />)
  return user
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
})

describe('InviteLink', () => {
  it('shows the link so it can be copied by hand', () => {
    setup()
    expect(screen.getByLabelText('Invite link')).toHaveValue(url)
    expect(screen.getByLabelText('Invite link')).toHaveAttribute('readonly')
  })

  it('copies the link and says so', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Copy invite link' }))

    expect(await navigator.clipboard.readText()).toBe(url)
    expect(screen.getByText('Link copied.')).toBeInTheDocument()
  })

  it('explains what to do when copying is not allowed', async () => {
    const user = setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    await user.click(screen.getByRole('button', { name: 'Copy invite link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/copy it by hand/i)
    expect(screen.queryByText('Link copied.')).not.toBeInTheDocument()
  })

  it('only offers to share where the device supports it', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })

  it('opens the share sheet with the link', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(share).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ url }))
  })

  it('stays quiet when the player closes the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
