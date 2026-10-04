import { useState } from 'react'
import type { Topic } from '../content/types'
import { MAX_TOPIC_LENGTH } from '../generation/request'

interface TopicChoiceProps {
  topics: Topic[]
  /** The chosen preset's id, the trimmed text of a custom topic, or null while there is none. */
  onChange: (topic: string | null) => void
  /** A topic to start with: a preset's id, or text for the custom field. */
  initial?: string | null
}

/** Picks a topic without acting on it: one preset, or the host's own text, never both. */
export function TopicChoice({ topics, onChange, initial = null }: TopicChoiceProps) {
  const initialIsPreset = topics.some((topic) => topic.id === initial)
  const [preset, setPreset] = useState<string | null>(initialIsPreset ? initial : null)
  const [custom, setCustom] = useState(initial && !initialIsPreset ? initial : '')

  function choosePreset(id: string) {
    setPreset(id)
    setCustom('')
    onChange(id)
  }

  function typeCustom(text: string) {
    setCustom(text)
    setPreset(null)
    onChange(text.trim() || null)
  }

  return (
    <fieldset className="topic-choice">
      <legend>Topic</legend>
      {topics.length === 0 ? (
        <p>No topics for this language pair yet.</p>
      ) : (
        <ul className="topic-grid">
          {topics.map((topic) => (
            <li key={topic.id}>
              <button
                type="button"
                className="topic-card"
                aria-pressed={preset === topic.id}
                onClick={() => choosePreset(topic.id)}
              >
                {topic.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label>
        Or enter your own topic
        <input value={custom} maxLength={MAX_TOPIC_LENGTH} onChange={(e) => typeCustom(e.target.value)} />
      </label>
    </fieldset>
  )
}
