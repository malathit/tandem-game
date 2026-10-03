import { useState, type ReactNode } from 'react'
import type { Language, LanguageCode } from '../content/types'

interface LanguagePickerProps {
  languages: Language[]
  label: string
  submitLabel: string
  /** A language that cannot be chosen, e.g. the one the partner already speaks. */
  exclude?: LanguageCode
  /** More form fields, shown between the language and the submit button. */
  children?: ReactNode
  /** Set to false while something else in `children` still has to be filled in. */
  canSubmit?: boolean
  onSubmit: (language: LanguageCode) => void
}

export function LanguagePicker({
  languages,
  label,
  submitLabel,
  exclude,
  children,
  canSubmit = true,
  onSubmit,
}: LanguagePickerProps) {
  const [choice, setChoice] = useState<LanguageCode | ''>('')

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (choice !== '' && canSubmit) onSubmit(choice)
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        {label}
        <select value={choice} onChange={(e) => setChoice(e.target.value as LanguageCode | '')}>
          <option value="">Choose a language</option>
          {languages
            .filter((language) => language.code !== exclude)
            .map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
        </select>
      </label>
      {children}
      <button type="submit" className="primary" disabled={choice === '' || !canSubmit}>
        {submitLabel}
      </button>
    </form>
  )
}
