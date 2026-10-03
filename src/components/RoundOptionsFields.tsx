import { DIFFICULTIES, MAX_COUNT, MIN_COUNT, isDifficulty, type Difficulty, type RoundOptions } from '../generation/types'

interface RoundOptionsFieldsProps {
  options: RoundOptions
  onChange: (options: RoundOptions) => void
}

const COUNTS = Array.from({ length: MAX_COUNT - MIN_COUNT + 1 }, (_, i) => MIN_COUNT + i)

const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

/** The host's choices for a round: how many sentences, how hard, and whether translations are shown. */
export function RoundOptionsFields({ options, onChange }: RoundOptionsFieldsProps) {
  return (
    <fieldset className="round-options">
      <legend>Round options</legend>
      <label>
        Sentences per player
        <select value={options.count} onChange={(e) => onChange({ ...options, count: Number(e.target.value) })}>
          {COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
      <label>
        Difficulty
        <select
          value={options.difficulty}
          onChange={(e) => isDifficulty(e.target.value) && onChange({ ...options, difficulty: e.target.value })}
        >
          {DIFFICULTIES.map((level) => (
            <option key={level} value={level}>
              {DIFFICULTY_NAMES[level]}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={options.translate}
          onChange={(e) => onChange({ ...options, translate: e.target.checked })}
        />
        Show the translation after each turn
      </label>
    </fieldset>
  )
}
