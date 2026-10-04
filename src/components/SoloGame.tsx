import { useEffect, useRef, useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import { createGame, gameReducer, type GameState } from '../game/gameReducer'
import { learningPair } from '../game/learningPair'
import { topicName } from '../game/topicName'
import { useRoundSetup } from '../game/useRoundSetup'
import type { SentenceGenerator } from '../generation/generator'
import type { GenerateTopic } from '../generation/types'
import type { HostSettings } from './HostSetup'
import { RoundPreview } from './RoundPreview'
import { TopicPicker } from './TopicPicker'
import { TurnView } from './TurnView'

const NOBODY_CONFIRMED = [false, false] as const

const topicText = (topic: GenerateTopic) => (topic.kind === 'preset' ? topic.id : topic.text)

interface SoloGameProps {
  languages: Language[]
  /** What the player chose before starting; the first round's sentences are written at once. */
  settings: HostSettings
  /** Where the AI's sentences come from; without it there is nothing to play. */
  generator?: SentenceGenerator
  onLeave: () => void
}

interface Round {
  topic: string
  game: GameState
}

/** One player practising alone: the same review and turns as the two-player game, without a partner or a network. */
export function SoloGame({ languages, settings, generator, onLeave }: SoloGameProps) {
  const { knows, learns, topic: firstTopic, options: firstOptions } = settings
  const setup = useRoundSetup(learningPair(knows, learns), generator, { solo: true })
  const { state: setupState, choose, back } = setup
  const [options, setOptions] = useState(firstOptions)
  const [round, setRound] = useState<Round | null>(null)
  // The topics are only shown once the player has left the review (or the round); the first request is made on arrival.
  const [picking, setPicking] = useState(false)
  const toTopics = () => {
    back()
    setPicking(true)
  }

  const startFirstRound = useRef(() => {})
  useEffect(() => {
    startFirstRound.current = () => choose(firstTopic, firstOptions)
  })
  useEffect(() => startFirstRound.current(), [])

  const nameOf = (code: string) => languages.find((language) => language.code === code)?.name ?? code

  function renderBody() {
    if (generator === undefined) {
      return (
        <p className="card" role="alert">
          AI sentences aren't available in this version of the game, so there is nothing to play yet.
        </p>
      )
    }

    if (round !== null) {
      return (
        <>
          <p className="topic">Topic: {topicName(staticSource, round.topic)}</p>
          <TurnView
            game={round.game}
            languages={languages}
            canAct
            onNext={() => setRound({ ...round, game: gameReducer(round.game, { type: 'NEXT_TURN' }) })}
            onReveal={() => setRound({ ...round, game: gameReducer(round.game, { type: 'REVEAL' }) })}
            onPrevious={() => setRound({ ...round, game: gameReducer(round.game, { type: 'PREVIOUS_TURN' }) })}
            onPlayAgain={() => {
              // Review again, so the topic gets new sentences rather than the same ones.
              setRound(null)
              choose(round.topic, options)
            }}
          />
        </>
      )
    }

    if (setupState.phase === 'preview') {
      const { topic, turns, busy, error } = setupState
      return (
        <RoundPreview
          me={1}
          review={{ turns, busy, error, confirmed: NOBODY_CONFIRMED }}
          topicLabel={topicName(staticSource, topicText(topic))}
          languages={languages}
          onConfirm={() => {
            setRound({ topic: topicText(topic), game: createGame(turns) })
            back()
          }}
          onRegenerate={setup.regenerate}
          onCancel={() => {
            setup.cancel()
            setPicking(true)
          }}
          onBack={toTopics}
        />
      )
    }

    if (!picking) return null
    return (
      <TopicPicker
        topics={staticSource.getTopics()}
        options={options}
        onOptionsChange={setOptions}
        onSelect={(topic) => choose(topic, options)}
        solo
      />
    )
  }

  return (
    <>
      <ul className="players">
        <li data-player="1">You are learning {nameOf(learns)}</li>
      </ul>
      {renderBody()}
      <div className="actions">
        {round !== null && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setRound(null)
              toTopics()
            }}
          >
            Change topic
          </button>
        )}
        <button type="button" className="secondary" onClick={onLeave}>
          Leave
        </button>
      </div>
    </>
  )
}
