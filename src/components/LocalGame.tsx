import { useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { Language, LanguagePair } from '../content/types'
import { buildTurns, type Turn } from '../game/buildTurns'
import { topicName } from '../game/topicName'
import { Game } from './Game'
import { LanguageSetup } from './LanguageSetup'
import { PlayerChips } from './PlayerChips'
import { StepIndicator } from './StepIndicator'
import { TopicPicker } from './TopicPicker'

interface Round {
  topic: string
  turns: Turn[]
  /** Changes with every new round so React gives <Game> a fresh state. */
  number: number
}

interface LocalGameProps {
  languages: Language[]
  onExit: () => void
}

/** Both players share one device and pass it back and forth. */
export function LocalGame({ languages, onExit }: LocalGameProps) {
  // Which screen shows is decided by what has been chosen so far:
  // no pair -> setup, pair but no round -> topic picker, both -> the game.
  const [pair, setPair] = useState<LanguagePair | null>(null)
  const [round, setRound] = useState<Round | null>(null)

  function changeLanguages() {
    setPair(null)
    setRound(null)
  }

  // The shuffle happens here, in an event handler, so it runs once per round
  // rather than on every render.
  function startRound(pair: LanguagePair, topic: string, number: number) {
    setRound({ topic, turns: buildTurns(pair, topic, staticSource), number })
  }

  const step = pair === null ? 1 : round === null ? 2 : 3

  return (
    <>
      <StepIndicator current={step} />
      {pair === null ? (
        <LanguageSetup languages={languages} onContinue={setPair} />
      ) : (
        <>
          <PlayerChips pair={pair} languages={languages} />
          {round === null ? (
            <TopicPicker
              topics={staticSource.getTopics(pair)}
              onSelect={(topic) => startRound(pair, topic, 1)}
            />
          ) : (
            <>
              <p className="topic">Topic: {topicName(staticSource, pair, round.topic)}</p>
              {round.turns.length === 0 ? (
                <p className="card" role="status">
                  No sentences yet for this topic.
                </p>
              ) : (
                // A new `key` makes React throw away the old <Game> and start a fresh one.
                <Game
                  key={round.number}
                  turns={round.turns}
                  languages={languages}
                  onPlayAgain={() => startRound(pair, round.topic, round.number + 1)}
                />
              )}
            </>
          )}
        </>
      )}
      <div className="actions">
        {round !== null && (
          <button type="button" className="secondary" onClick={() => setRound(null)}>
            Change topic
          </button>
        )}
        {pair !== null && (
          <button type="button" className="secondary" onClick={changeLanguages}>
            Change languages
          </button>
        )}
        <button type="button" className="secondary" onClick={onExit}>
          Back to start
        </button>
      </div>
    </>
  )
}
