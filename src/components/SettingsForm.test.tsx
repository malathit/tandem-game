import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { staticSource } from '../content/staticSource'
import { DEFAULT_ROUND_OPTIONS } from '../generation/types'
import { SettingsForm } from './SettingsForm'

const languages = staticSource.getLanguages()

function setup(defaults = null as React.ComponentProps<typeof SettingsForm>['defaults'], withBack = true) {
  const onSave = vi.fn()
  const onBack = vi.fn()
  const user = userEvent.setup()
  render(<SettingsForm languages={languages} defaults={defaults} onSave={onSave} onBack={withBack ? onBack : undefined} />)
  return { user, onSave, onBack }
}

describe('SettingsForm', () => {
  it('needs both languages before it saves', async () => {
    const { user, onSave } = setup()
    const save = screen.getByRole('button', { name: 'Save settings' })
    expect(save).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('I speak'), 'en')
    expect(save).toBeDisabled()
    await user.selectOptions(screen.getByLabelText("I'm learning"), 'de')
    await user.click(save)
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ knows: 'en', learns: 'de', options: DEFAULT_ROUND_OPTIONS })
  })

  it('cannot learn the language it speaks, and clears a learning choice that the speaking choice now clashes with', async () => {
    const { user } = setup()
    await user.selectOptions(screen.getByLabelText('I speak'), 'en')
    const learning = screen.getByLabelText("I'm learning")
    expect(within(learning).queryByRole('option', { name: 'English' })).not.toBeInTheDocument()
    await user.selectOptions(learning, 'de')

    await user.selectOptions(screen.getByLabelText('I speak'), 'de')
    expect(screen.getByLabelText("I'm learning")).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  })

  it('starts from what is saved and saves the changes', async () => {
    const { user, onSave } = setup({ knows: 'de', learns: 'en', options: { count: 3, difficulty: 'easy', review: true } })
    expect(screen.getByLabelText('I speak')).toHaveValue('de')
    expect(screen.getByLabelText("I'm learning")).toHaveValue('en')
    expect(screen.getByLabelText('Sentences per player')).toHaveValue('3')
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'hard')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      knows: 'de',
      learns: 'en',
      options: { count: 3, difficulty: 'hard', review: true },
    })
  })

  it('explains every setting', () => {
    setup()
    expect(screen.getByLabelText('I speak')).toHaveAccessibleDescription(/your sentences are written in/i)
    expect(screen.getByLabelText("I'm learning")).toHaveAccessibleDescription(/the language your partner speaks/i)
    expect(screen.getByLabelText('Sentences per player')).toHaveAccessibleDescription(/reads aloud in a round/i)
    expect(screen.getByLabelText('Difficulty')).toHaveAccessibleDescription(/Easy: .*4 to 7 words.*Medium: .*Hard: .*8 to 11 words/)
  })

  it('goes back without saving, when there is somewhere to go back to', async () => {
    const { user, onSave, onBack } = setup()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('has no Back button when there is nowhere to go back to', () => {
    setup(null, false)
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })
})
