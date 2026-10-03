import { useEffect, useRef, useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { Language, LanguageCode } from '../content/types'
import type { SentenceGenerator } from '../generation/generator'
import type { GenerateTopic, RoundOptions } from '../generation/types'
import { learningPair } from '../game/learningPair'
import { topicName } from '../game/topicName'
import { useRoundSetup } from '../game/useRoundSetup'
import type { Network } from '../online/network'
import { useHostSession } from '../online/useHostSession'
import { buildInviteUrl } from '../online/inviteLink'
import { InviteLink } from './InviteLink'
import { PlayerChips } from './PlayerChips'
import { RoundPreview } from './RoundPreview'
import { StepIndicator } from './StepIndicator'
import { TopicPicker } from './TopicPicker'
import { TurnView } from './TurnView'

const NOBODY_CONFIRMED = [false, false] as const

/** The topic as the rest of the game knows it: a preset's id or the text the host typed. */
const topicText = (topic: GenerateTopic) => (topic.kind === 'preset' ? topic.id : topic.text)

interface HostRoomProps {
  network: Network
  languages: Language[]
  hostKnows: LanguageCode
  /** The topic and options the host set before the game was opened; its sentences are written once the partner is in. */
  firstRound: { topic: string; options: RoundOptions }
  /** Where the AI's sentences come from; without it there is nothing to play. */
  generator?: SentenceGenerator
  onLeave: () => void
}

/** The device that created the game: it is Player 1 and runs the game for both. */
export function HostRoom({ network, languages, hostKnows, firstRound, generator, onLeave }: HostRoomProps) {
  // The guest can ask for new sentences, but the request is made from here, so the session calls back.
  const guestRegenerate = useRef(() => {})
  const { status, code, room, partnerConnected, dispatch } = useHostSession(
    network,
    hostKnows,
    () => guestRegenerate.current(),
    firstRound.topic,
    generator !== undefined,
  )
  const { guestKnows, round } = room
  const pair = guestKnows === null ? null : learningPair(room.hostKnows, guestKnows)
  const setup = useRoundSetup(pair, generator)
  const { state: setupState, back: backToTopics } = setup
  const [options, setOptions] = useState(firstRound.options)
  const step = pair === null ? 1 : round === null ? 2 : 3
  const reviewing = setupState.phase === 'preview'
  const roundRunning = round !== null

  useEffect(() => {
    guestRegenerate.current = setup.regenerate
  })

  // Once the partner has chosen their language, the sentences can be written: the host already chose what for.
  const startFirstRound = useRef(() => {})
  useEffect(() => {
    startFirstRound.current = () => setup.choose(firstRound.topic, firstRound.options)
  })
  const partnerChoseLanguage = pair !== null
  useEffect(() => {
    if (partnerChoseLanguage) startFirstRound.current()
  }, [partnerChoseLanguage])

  // The guest reviews their sentences too, so the room carries a copy of the host's review.
  // Until the first review has begun, the room's starting review (see `useHostSession`) stays.
  const firstReviewPending = useRef(true)
  useEffect(() => {
    if (setupState.phase === 'preview') {
      firstReviewPending.current = false
      const { topic, turns, busy, error } = setupState
      dispatch({ type: 'REVIEW_UPDATED', topic: topicText(topic), turns, busy, error })
    } else if (!firstReviewPending.current) {
      dispatch({ type: 'REVIEW_CLOSED' })
    }
  }, [setupState, dispatch])

  // Once both players have confirmed, the room starts the round and the review is over.
  useEffect(() => {
    if (roundRunning && reviewing) backToTopics()
  }, [roundRunning, reviewing, backToTopics])

  function renderBody() {
    if (status === 'opening') {
      return (
        <p className="waiting" role="status">
          Setting up your game…
        </p>
      )
    }
    if (status === 'error') {
      return (
        <p className="card" role="alert">
          We couldn't open a game. Check your internet connection and try again.
        </p>
      )
    }
    if (pair === null && partnerConnected) {
      return (
        <section className="card joined" role="status">
          <h2>Your partner has joined! 🎉</h2>
          <p>Waiting for them to choose their language…</p>
        </section>
      )
    }
    if (pair === null) {
      return (
        <section className="card">
          <h2>Invite your partner</h2>
          <p>Send your partner this link, or ask them to choose “Join a game” and enter this code:</p>
          <p className="room-code">{code}</p>
          {code !== null && <InviteLink url={buildInviteUrl(code, window.location.href)} />}
          <p role="status">Waiting for your partner to join…</p>
        </section>
      )
    }
    if (round === null) {
      if (setupState.phase === 'preview') {
        const { topic, turns, busy, error } = setupState
        return (
          <>
            <PlayerChips pair={pair} languages={languages} me={1} />
            <RoundPreview
              me={1}
              review={{ turns, busy, error, confirmed: room.review?.confirmed ?? NOBODY_CONFIRMED }}
              topicLabel={topicName(staticSource, topicText(topic))}
              languages={languages}
              onConfirm={() => dispatch({ type: 'CONFIRM', from: 1 })}
              onRegenerate={setup.regenerate}
              onCancel={setup.cancel}
              onBack={backToTopics}
            />
          </>
        )
      }
      return (
        <>
          <PlayerChips pair={pair} languages={languages} me={1} />
          {generator === undefined ? (
            <p className="card" role="alert">
              AI sentences aren't available in this version of the game, so there is nothing to play yet.
            </p>
          ) : (
            <TopicPicker
              topics={staticSource.getTopics()}
              options={options}
              onOptionsChange={setOptions}
              onSelect={(topic) => setup.choose(topic, options)}
            />
          )}
        </>
      )
    }

    const { game } = round
    const myTurn = game.status === 'playing' && game.turns[game.index].player === 1
    return (
      <>
        <PlayerChips pair={pair} languages={languages} me={1} />
        <p className="topic">Topic: {topicName(staticSource, round.topic)}</p>
        <TurnView
          game={game}
          languages={languages}
          canAct={myTurn}
          onNext={() => dispatch({ type: 'NEXT_TURN', from: 1 })}
          onReveal={() => dispatch({ type: 'REVEAL', from: 1 })}
          onPlayAgain={() => {
            // Review again, so the topic gets new sentences rather than the same ones.
            dispatch({ type: 'CHANGE_TOPIC' })
            setup.choose(round.topic, options)
          }}
        />
      </>
    )
  }

  return (
    <>
      <StepIndicator current={step} />
      {pair !== null && !partnerConnected && (
        <p className="notice" role="status">
          Your partner is disconnected. They can rejoin with the code {code}.
        </p>
      )}
      {renderBody()}
      <div className="actions">
        {round !== null && (
          <button type="button" className="secondary" onClick={() => dispatch({ type: 'CHANGE_TOPIC' })}>
            Change topic
          </button>
        )}
        <button type="button" className="secondary" onClick={onLeave}>
          Leave game
        </button>
      </div>
    </>
  )
}
