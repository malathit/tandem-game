import { useState } from 'react'
import type { Topic } from '../content/types'
import { MAX_COUNT, MIN_COUNT, type RoundOptions } from '../generation/types'

interface TopicPickerProps {
  topics: Topic[]
  /** The round's settings; the host keeps them, so they survive another round. */
  options: RoundOptions
  onOptionsChange: (options: RoundOptions) => void
  /** Called with a preset topic's id, or with the trimmed text of a custom topic. */
  onSelect: (topic: string) => void
}

const COUNTS = Array.from({ length: MAX_COUNT - MIN_COUNT + 1 }, (_, i) => MIN_COUNT + i)

export function TopicPicker({ topics, options, onOptionsChange, onSelect }: TopicPickerProps) {
  const [custom, setCustom] = useState('')
  const customTopic = custom.trim()

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (customTopic) {
      onSelect(customTopic)
    }
  }

  return (
    <section className="card">
      <h2>Choose a topic</h2>
      <fieldset className="round-options">
        <legend>Round options</legend>
        <label>
          Sentences per player
          <select
            value={options.count}
            onChange={(e) => onOptionsChange({ ...options, count: Number(e.target.value) })}
          >
            {COUNTS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={options.translate}
            onChange={(e) => onOptionsChange({ ...options, translate: e.target.checked })}
          />
          Show the translation after each turn
        </label>
      </fieldset>
      {topics.length === 0 ? (
        <p>No topics for this language pair yet.</p>
      ) : (
        // Rendering a list: one <li> per topic, each with a stable `key`.
        <ul className="topic-grid">
          {topics.map((topic) => (
            <li key={topic.id}>
              <button type="button" className="topic-card" onClick={() => onSelect(topic.id)}>
                {topic.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit}>
        <label>
          Or enter your own topic
          <input value={custom} maxLength={60} onChange={(e) => setCustom(e.target.value)} />
        </label>
        <button type="submit" className="primary" disabled={!customTopic}>
          Use this topic
        </button>
      </form>
    </section>
  )
}
