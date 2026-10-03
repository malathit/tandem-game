import { useState } from 'react'
import type { Topic } from '../content/types'

interface TopicPickerProps {
  topics: Topic[]
  /** Called with a preset topic's id, or with the trimmed text of a custom topic. */
  onSelect: (topic: string) => void
}

export function TopicPicker({ topics, onSelect }: TopicPickerProps) {
  const [custom, setCustom] = useState('')
  const customTopic = custom.trim()

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (customTopic) {
      onSelect(customTopic)
    }
  }

  return (
    <section>
      <h2>Choose a topic</h2>
      {topics.length === 0 ? (
        <p>No topics for this language pair yet.</p>
      ) : (
        // Rendering a list: one <li> per topic, each with a stable `key`.
        <ul>
          {topics.map((topic) => (
            <li key={topic.id}>
              <button type="button" onClick={() => onSelect(topic.id)}>
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
        <button type="submit" disabled={!customTopic}>
          Use this topic
        </button>
      </form>
    </section>
  )
}
