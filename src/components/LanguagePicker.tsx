import { useState } from 'react'
import type { Language, LanguageCode } from '../content/types'

interface LanguagePickerProps {
  languages: Language[]
  label: string
  submitLabel: string
  /** A language that cannot be chosen, e.g. the one the partner is already learning. */
  exclude?: LanguageCode
  onSubmit: (language: LanguageCode) => void
}

export function LanguagePicker({ languages, label, submitLabel, exclude, onSubmit }: LanguagePickerProps) {
  const [choice, setChoice] = useState<LanguageCode | ''>('')

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (choice !== '') onSubmit(choice)
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
      <button type="submit" className="primary" disabled={choice === ''}>
        {submitLabel}
      </button>
    </form>
  )
}
