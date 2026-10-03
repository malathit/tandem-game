import { useState } from 'react'
import { Game } from './components/Game'
import { LanguageSetup } from './components/LanguageSetup'
import { TopicPicker } from './components/TopicPicker'
import { staticSource } from './content/staticSource'
import type { LanguagePair } from './content/types'
import { buildTurns, type Turn } from './game/buildTurns'

const languages = staticSource.getLanguages()

const nameOf = (code: string) => languages.find((l) => l.code === code)?.name ?? code

interface Round {
  topic: string
  turns: Turn[]
}

function App() {
  // Which screen shows is decided by what has been chosen so far:
  // no pair -> setup, pair but no round -> topic picker, both -> the game.
  const [pair, setPair] = useState<LanguagePair | null>(null)
  const [round, setRound] = useState<Round | null>(null)

  function changeLanguages() {
    setPair(null)
    setRound(null)
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
          {round === null ? (
            <TopicPicker
              topics={staticSource.getTopics(pair)}
              // The shuffle happens here, in an event handler, so it runs once
              // per round rather than on every render.
              onSelect={(topic) => setRound({ topic, turns: buildTurns(pair, topic, staticSource) })}
            />
          ) : (
            <>
              {/* A topic is either a preset id (shown by its name) or text the players typed. */}
              <p>Topic: {staticSource.getTopics(pair).find((t) => t.id === round.topic)?.name ?? round.topic}</p>
              {round.turns.length === 0 ? (
                <p role="status">No sentences yet for this topic.</p>
              ) : (
                <Game turns={round.turns} languages={languages} />
              )}
              <button type="button" onClick={() => setRound(null)}>
                Change topic
              </button>
            </>
          )}
          <button type="button" onClick={changeLanguages}>
            Change languages
          </button>
        </>
      )}
    </main>
  )
}

export default App
