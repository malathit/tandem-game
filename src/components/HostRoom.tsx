import { staticSource } from '../content/staticSource'
import type { Language, LanguageCode } from '../content/types'
import { buildTurns, sentencesFor } from '../game/buildTurns'
import type { SentenceGenerator } from '../generation/generator'
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

interface HostRoomProps {
  network: Network
  languages: Language[]
  hostLearning: LanguageCode
  /** Where AI sentences come from; without it the host can only play the hand-written topics. */
  generator?: SentenceGenerator
  onLeave: () => void
}

/** The device that created the game: it is Player 1 and runs the game for both. */
export function HostRoom({ network, languages, hostLearning, generator, onLeave }: HostRoomProps) {
  const { status, code, room, partnerConnected, dispatch } = useHostSession(network, hostLearning)
  const { guestLearning, round } = room
  const pair = guestLearning === null ? null : ([room.hostLearning, guestLearning] as const)
  const setup = useRoundSetup(pair, generator)
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
      const { state } = setup
      if (state.phase === 'preview') {
        const topic = state.topic.kind === 'preset' ? state.topic.id : state.topic.text
        return (
          <>
            <PlayerChips pair={pair} languages={languages} me={1} />
            <RoundPreview
              setup={state}
              topicLabel={topicName(staticSource, pair, topic)}
              languages={languages}
              onStart={() => {
                dispatch({ type: 'START_ROUND', topic, turns: state.turns })
                setup.back()
              }}
              onRegenerate={setup.regenerate}
              onCancel={setup.cancel}
              onBack={setup.back}
            />
          </>
        )
      }
      return (
        <>
          <PlayerChips pair={pair} languages={languages} me={1} />
          {state.notice !== null && (
            <p className="notice" role="status">
              No sentences yet for “{state.notice}”. Choose another topic.
            </p>
          )}
          <TopicPicker
            topics={staticSource.getTopics(pair)}
            onSelect={(topic) => {
              if (generator === undefined) {
                // Nothing to review: hand-written topics start at once.
                const turns = buildTurns(pair, sentencesFor(staticSource, pair, topic))
                if (turns.length > 0) {
                  dispatch({ type: 'START_ROUND', topic, turns })
                  setup.back()
                  return
                }
              }
              setup.choose(topic)
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
          onPlayAgain={() => {
            if (generator === undefined) {
              dispatch({ type: 'PLAY_AGAIN', turns: buildTurns(pair, sentencesFor(staticSource, pair, round.topic)) })
            } else {
              // Review again, so a topic the AI wrote gets new sentences rather than the same ones.
              dispatch({ type: 'CHANGE_TOPIC' })
              setup.choose(round.topic)
            }
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
