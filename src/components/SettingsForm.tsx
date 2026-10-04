import { useId, useState } from 'react'
import type { Language, LanguageCode } from '../content/types'
import type { HostDefaults } from '../game/hostPreferences'
import { DEFAULT_ROUND_OPTIONS } from '../generation/types'
import { RoundOptionsFields } from './RoundOptionsFields'

interface SettingsFormProps {
  languages: Language[]
  /** What is saved now; shown as the starting values. */
  defaults: HostDefaults | null
  onSave: (defaults: HostDefaults) => void
  /** Leave without saving; missing when there is nothing to go back to. */
  onBack?: () => void
}

/** Where the host sets their languages and round options once, so each new game starts from them. */
export function SettingsForm({ languages, defaults, onSave, onBack }: SettingsFormProps) {
  const [knows, setKnows] = useState<LanguageCode | ''>(defaults?.knows ?? '')
  const [learns, setLearns] = useState<LanguageCode | ''>(defaults?.learns ?? '')
  const [options, setOptions] = useState(defaults?.options ?? DEFAULT_ROUND_OPTIONS)
  const id = useId()
  const nameOf = (code: LanguageCode) => languages.find((language) => language.code === code)?.name ?? code

  function chooseKnows(code: LanguageCode | '') {
    setKnows(code)
    // The two languages must differ, so a clash clears the other choice.
    if (code === learns) setLearns('')
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (knows !== '' && learns !== '') onSave({ knows, learns, options })
  }

  return (
    <section className="card">
      <h2>Settings</h2>
      <p>Set these once. Every game you create starts from them, and you can change them here whenever you like.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>
            I speak
            <select
              aria-describedby={`${id}-knows`}
              value={knows}
              onChange={(e) => chooseKnows(e.target.value as LanguageCode | '')}
            >
              <option value="">Choose a language</option>
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          <small id={`${id}-knows`} className="help">
            The language your sentences are written in. Your partner practises it.
          </small>
        </div>
        <div className="field">
          <label>
            I'm learning
            <select
              aria-describedby={`${id}-learns`}
              value={learns}
              onChange={(e) => setLearns(e.target.value as LanguageCode | '')}
            >
              <option value="">Choose a language</option>
              {languages
                .filter((language) => language.code !== knows)
                .map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name}
                  </option>
                ))}
            </select>
          </label>
          <small id={`${id}-learns`} className="help">
            The language you say each sentence in. It is also the language your partner speaks, so they join with
            nothing to set up.
          </small>
        </div>
        {knows !== '' && learns !== '' && (
          <p className="settings-example" role="status">
            You will read sentences in {nameOf(knows)} and say them aloud in {nameOf(learns)}.
          </p>
        )}
        <RoundOptionsFields options={options} onChange={setOptions} withHelp />
        <button type="submit" className="primary" disabled={knows === '' || learns === ''}>
          Save settings
        </button>
      </form>
      {onBack && (
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
      )}
    </section>
  )
}
