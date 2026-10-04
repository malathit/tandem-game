import { useId } from 'react'
import { DIFFICULTIES, MAX_COUNT, MIN_COUNT, isDifficulty, type Difficulty, type RoundOptions } from '../generation/types'

interface RoundOptionsFieldsProps {
  options: RoundOptions
  onChange: (options: RoundOptions) => void
  /** One player: the count is not per player. */
  solo?: boolean
  /** Explain each option under it. */
  withHelp?: boolean
}

const COUNTS = Array.from({ length: MAX_COUNT - MIN_COUNT + 1 }, (_, i) => MIN_COUNT + i)

const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

const COUNT_HELP = 'How many sentences each of you reads aloud in a round, from 1 to 5.'

const REVIEW_HELP = 'Read the sentences before the round starts, and ask for new ones if you like.'

const DIFFICULTY_HELP: Record<Difficulty, string> = {
  easy: 'short sentences of 4 to 7 words, in the present tense, with everyday words.',
  medium: 'everyday sentences of 4 to 12 words.',
  hard: 'longer sentences of 8 to 11 words, with clauses, different tenses and less common words.',
}

/** The host's choices for a round: how many sentences, and how hard. */
export function RoundOptionsFields({ options, onChange, solo = false, withHelp = false }: RoundOptionsFieldsProps) {
  const id = useId()
  const describedBy = (key: 'count' | 'difficulty' | 'review') => (withHelp ? `${id}-${key}` : undefined)

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
        {withHelp && (
          <small id={`${id}-count`} className="help">
            {COUNT_HELP}
          </small>
        )}
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
        {withHelp && (
          <ul id={`${id}-difficulty`} className="help help-levels">
            {DIFFICULTIES.map((level) => (
              <li key={level} data-selected={level === options.difficulty || undefined}>
                <strong>{DIFFICULTY_NAMES[level]}:</strong> {DIFFICULTY_HELP[level]}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={options.review}
            aria-describedby={describedBy('review')}
            onChange={(e) => onChange({ ...options, review: e.target.checked })}
          />
          Review sentences before the round
        </label>
        {withHelp && (
          <small id={`${id}-review`} className="help">
            {REVIEW_HELP}
          </small>
        )}
      </div>
    </fieldset>
  )
}
