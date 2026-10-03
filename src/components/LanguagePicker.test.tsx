import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Language, LanguageCode } from '../content/types'
import { LanguagePicker } from './LanguagePicker'

const languages: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]

function setup(exclude?: LanguageCode) {
  const onSubmit = vi.fn()
  render(
    <LanguagePicker
      languages={languages}
      label="I am learning"
      submitLabel="Create game"
      exclude={exclude}
      onSubmit={onSubmit}
    />,
  )
  return { onSubmit, user: userEvent.setup(), select: screen.getByLabelText('I am learning') }
}

describe('LanguagePicker', () => {
  it('disables the button until a language is chosen', async () => {
    const { user, select } = setup()
    const button = screen.getByRole('button', { name: 'Create game' })
    expect(button).toBeDisabled()
    await user.selectOptions(select, 'de')
    expect(button).toBeEnabled()
  })

  it('reports the chosen language', async () => {
    const { user, select, onSubmit } = setup()
    await user.selectOptions(select, 'de')
    await user.click(screen.getByRole('button', { name: 'Create game' }))
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('de')
  })

  it('does not offer the excluded language', () => {
    const { select } = setup('en')
    expect(within(select).queryByRole('option', { name: 'English' })).not.toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'German' })).toBeInTheDocument()
  })
})
