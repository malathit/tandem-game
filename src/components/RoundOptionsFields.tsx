import { useId } from 'react'
import { DIFFICULTIES, MAX_COUNT, MIN_COUNT, isDifficulty, type Difficulty, type RoundOptions } from '../generation/types'

interface RoundOptionsFieldsProps {
  options: RoundOptions
  onChange: (options: RoundOptions) => void
  /** One player: the count is not per player, and translations are always on, so there is no switch. */
  solo?: boolean
  /** Explain each option under it. */
  withHelp?: boolean
}

const COUNTS = Array.from({ length: MAX_COUNT - MIN_COUNT + 1 }, (_, i) => MIN_COUNT + i)

const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

const HELP = {
  count: 'How many sentences each of you reads aloud in a round, from 1 to 5.',
  difficulty: 'Easy: short, present-tense sentences. Medium: everyday length. Hard: longer, with richer grammar.',
  translate:
    'After each turn the speaker can reveal the sentence in the language they are learning, on both screens, to check their answer.',
}

/** The host's choices for a round: how many sentences, how hard, and whether translations are shown. */
export function RoundOptionsFields({ options, onChange, solo = false, withHelp = false }: RoundOptionsFieldsProps) {
  const id = useId()
  const describedBy = (key: keyof typeof HELP) => (withHelp ? `${id}-${key}` : undefined)
  const help = (key: keyof typeof HELP) =>
    withHelp && (
      <small id={`${id}-${key}`} className="help">
        {HELP[key]}
      </small>
    )

  return (
    <fieldset className="round-options">
      <legend>Round options</legend>
      <div className="field">
        <label>
          {solo ? 'Sentences' : 'Sentences per player'}
          <select
            value={options.count}
            aria-describedby={describedBy('count')}
            onChange={(e) => onChange({ ...options, count: Number(e.target.value) })}
          >
            {COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        {help('count')}
      </div>
      <div className="field">
        <label>
          Difficulty
          <select
            value={options.difficulty}
            aria-describedby={describedBy('difficulty')}
            onChange={(e) => isDifficulty(e.target.value) && onChange({ ...options, difficulty: e.target.value })}
          >
            {DIFFICULTIES.map((level) => (
              <option key={level} value={level}>
                {DIFFICULTY_NAMES[level]}
              </option>
            ))}
          </select>
        </label>
        {help('difficulty')}
      </div>
      {!solo && (
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={options.translate}
              aria-describedby={describedBy('translate')}
              onChange={(e) => onChange({ ...options, translate: e.target.checked })}
            />
            Show the translation after each turn
          </label>
          {help('translate')}
        </div>
      )}
    </fieldset>
  )
}
