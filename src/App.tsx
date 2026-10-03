import { useState } from 'react'
import { LanguageSetup } from './components/LanguageSetup'
import { TopicPicker } from './components/TopicPicker'
import { staticSource } from './content/staticSource'
import type { LanguagePair } from './content/types'

const languages = staticSource.getLanguages()

const nameOf = (code: string) => languages.find((l) => l.code === code)?.name ?? code

function App() {
  // Which screen shows is decided by what has been chosen so far:
  // no pair -> setup, pair but no topic -> topic picker, both -> summary.
  const [pair, setPair] = useState<LanguagePair | null>(null)
  const [topic, setTopic] = useState<string | null>(null)

  function changeLanguages() {
    setPair(null)
    setTopic(null)
  }

  return (
    <main>
      <h1>Tandem Game</h1>
      {pair === null ? (
        <LanguageSetup languages={languages} onContinue={setPair} />
      ) : (
        <>
          <p>Player 1 is learning {nameOf(pair[0])}.</p>
          <p>Player 2 is learning {nameOf(pair[1])}.</p>
          {topic === null ? (
            <TopicPicker topics={staticSource.getTopics(pair)} onSelect={setTopic} />
          ) : (
            <TopicSummary pair={pair} topic={topic} onChangeTopic={() => setTopic(null)} />
          )}
          <button type="button" onClick={changeLanguages}>
            Change languages
          </button>
        </>
      )}
    </main>
  )
}

interface TopicSummaryProps {
  pair: LanguagePair
  topic: string
  onChangeTopic: () => void
}

// Temporary: the turn-taking screen replaces this in the next step.
function TopicSummary({ pair, topic, onChangeTopic }: TopicSummaryProps) {
  // A topic is either a preset id (shown by its name) or text the players typed.
  const topicName = staticSource.getTopics(pair).find((t) => t.id === topic)?.name ?? topic
  const hasSentences = pair.every((language) => staticSource.getSentences(language, topic).length > 0)

  return (
    <>
      <p>Topic: {topicName}</p>
      <p role="status">
        {hasSentences ? 'Sentences are ready for this topic.' : 'No sentences yet for this topic.'}
      </p>
      <button type="button" onClick={onChangeTopic}>
        Change topic
      </button>
    </>
  )
}

export default App
