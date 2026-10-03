import { useState } from 'react'
import type { Language, LanguageCode, LanguagePair } from '../content/types'

type Choice = LanguageCode | ''

interface LanguageSelectProps {
  label: string
  value: Choice
  languages: Language[]
  onChange: (value: Choice) => void
}

function LanguageSelect({ label, value, languages, onChange }: LanguageSelectProps) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as Choice)}>
        <option value="">Choose a language</option>
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </label>
  )
}

interface LanguageSetupProps {
  languages: Language[]
  onContinue: (pair: LanguagePair) => void
}

export function LanguageSetup({ languages, onContinue }: LanguageSetupProps) {
  // State: values the screen remembers between renders. Changing it re-renders.
  const [player1, setPlayer1] = useState<Choice>('')
  const [player2, setPlayer2] = useState<Choice>('')

  // Derived from state on every render, so it never needs its own useState.
  const bothChosen = player1 !== '' && player2 !== ''
  const sameLanguage = bothChosen && player1 === player2

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (bothChosen && !sameLanguage) {
      onContinue([player1, player2])
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <LanguageSelect
        label="Player 1 is learning"
        value={player1}
        languages={languages}
        onChange={setPlayer1}
      />
      <LanguageSelect
        label="Player 2 is learning"
        value={player2}
        languages={languages}
        onChange={setPlayer2}
      />
      {sameLanguage && <p role="alert">Players need to learn different languages.</p>}
      <button type="submit" disabled={!bothChosen || sameLanguage}>
        Continue
      </button>
    </form>
  )
}
