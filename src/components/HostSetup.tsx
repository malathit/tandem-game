import { useState } from 'react'
import type { Language, LanguageCode, Topic } from '../content/types'
import { DEFAULT_ROUND_OPTIONS, type RoundOptions } from '../generation/types'
import { LanguagePicker } from './LanguagePicker'
import { RoundOptionsFields } from './RoundOptionsFields'
import { TopicChoice } from './TopicChoice'

/** What the host decides before the invite link exists. */
export interface HostSettings {
  knows: LanguageCode
  /** A preset topic's id, or the text the host typed. */
  topic: string
  options: RoundOptions
}

interface HostSetupProps {
  languages: Language[]
  topics: Topic[]
  onCreate: (settings: HostSettings) => void
  onBack: () => void
  /** Practising alone: nothing is hosted, and translations are always on. */
  solo?: boolean
}

/** The first thing the host sees: their language and the round, before the game is opened. */
export function HostSetup({ languages, topics, onCreate, onBack, solo = false }: HostSetupProps) {
  const [options, setOptions] = useState(DEFAULT_ROUND_OPTIONS)
  const [topic, setTopic] = useState<string | null>(null)

  return (
    <section className="card">
      <h2>{solo ? 'Practise on your own' : 'Create a game'}</h2>
      <LanguagePicker
        languages={languages}
        label="I speak"
        submitLabel={solo ? 'Start' : 'Create game'}
        canSubmit={topic !== null}
        onSubmit={(knows) => topic !== null && onCreate({ knows, topic, options: solo ? { ...options, translate: true } : options })}
      >
        <RoundOptionsFields options={options} onChange={setOptions} solo={solo} />
        <TopicChoice topics={topics} onChange={setTopic} />
        {topic === null && <p className="hint">Choose a topic to {solo ? 'start' : 'create the game'}.</p>}
      </LanguagePicker>
      <button type="button" className="secondary" onClick={onBack}>
        Back
      </button>
    </section>
  )
}
