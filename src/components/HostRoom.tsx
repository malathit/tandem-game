import { useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { Language, LanguageCode } from '../content/types'
import { buildTurns } from '../game/buildTurns'
import { topicName } from '../game/topicName'
import type { Network } from '../online/network'
import { useHostSession } from '../online/useHostSession'
import { buildInviteUrl } from '../online/inviteLink'
import { InviteLink } from './InviteLink'
import { PlayerChips } from './PlayerChips'
import { StepIndicator } from './StepIndicator'
import { TopicPicker } from './TopicPicker'
import { TurnView } from './TurnView'

interface HostRoomProps {
  network: Network
  languages: Language[]
  hostLearning: LanguageCode
  onLeave: () => void
}

/** The device that created the game: it is Player 1 and runs the game for both. */
export function HostRoom({ network, languages, hostLearning, onLeave }: HostRoomProps) {
  const { status, code, room, partnerConnected, dispatch } = useHostSession(network, hostLearning)
  const [emptyTopic, setEmptyTopic] = useState<string | null>(null)
  const { guestLearning, round } = room
  const pair = guestLearning === null ? null : ([room.hostLearning, guestLearning] as const)
  const step = pair === null ? 1 : round === null ? 2 : 3

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
    if (pair === null) {
      return (
        <section className="card">
          <h2>Invite your partner</h2>
          <p>Send your partner this link, or ask them to choose “Join a game” and enter this code:</p>
          <p className="room-code">{code}</p>
          {code !== null && <InviteLink url={buildInviteUrl(code, window.location.href)} />}
          <p role="status">
            {partnerConnected
              ? 'Your partner is connected. Waiting for them to choose a language…'
              : 'Waiting for your partner to join…'}
          </p>
        </section>
      )
    }
    if (round === null) {
      return (
        <>
          <PlayerChips pair={pair} languages={languages} me={1} />
          {emptyTopic !== null && (
            <p className="notice" role="status">
              No sentences yet for “{emptyTopic}”. Choose another topic.
            </p>
          )}
          <TopicPicker
            topics={staticSource.getTopics(pair)}
            onSelect={(topic) => {
              // The shuffle happens here, in an event handler, so it runs once per round.
              const turns = buildTurns(pair, topic, staticSource)
              setEmptyTopic(turns.length === 0 ? topic : null)
              dispatch({ type: 'START_ROUND', topic, turns })
            }}
          />
        </>
      )
    }

    const { game } = round
    const myTurn = game.status === 'playing' && game.turns[game.index].player === 1
    return (
      <>
        <PlayerChips pair={pair} languages={languages} me={1} />
        <p className="topic">Topic: {topicName(staticSource, pair, round.topic)}</p>
        <TurnView
          game={game}
          languages={languages}
          canAct={myTurn}
          onNext={() => dispatch({ type: 'NEXT_TURN', from: 1 })}
          onPlayAgain={() =>
            dispatch({ type: 'PLAY_AGAIN', turns: buildTurns(pair, round.topic, staticSource) })
          }
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
