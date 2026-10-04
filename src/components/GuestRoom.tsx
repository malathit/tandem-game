import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import { learningPair } from '../game/learningPair'
import { topicName } from '../game/topicName'
import type { Network } from '../online/network'
import { useGuestSession, type GuestSession } from '../online/useGuestSession'
import { PlayerChips } from './PlayerChips'
import { RoundPreview } from './RoundPreview'
import { StepIndicator } from './StepIndicator'
import { TurnView } from './TurnView'

interface GuestRoomProps {
  network: Network
  languages: Language[]
  code: string
  onRetry: () => void
  onChangeCode: () => void
  onLeave: () => void
}

const PROBLEMS: Record<Exclude<GuestSession['status'], 'connecting' | 'connected'>, string> = {
  'not-found': "We couldn't find a game with that code. Check it and try again.",
  unavailable: "We couldn't reach the game service. Check your internet connection and try again.",
  lost: 'The connection to your partner was lost.',
}

/** The device that joined: it is Player 2 and shows what the host says is happening. */
export function GuestRoom({ network, languages, code, onRetry, onChangeCode, onLeave }: GuestRoomProps) {
  const { status, room, confirm, regenerate, nextTurn, reveal } = useGuestSession(network, code)

  function renderBody() {
    if (status === 'connecting') {
      return (
        <p className="waiting" role="status">
          Connecting to the game…
        </p>
      )
    }
    if (status !== 'connected') {
      return (
        <section className="card">
          <p role="alert">{PROBLEMS[status]}</p>
          <button type="button" className="primary" onClick={onRetry}>
            Try again
          </button>
          <button type="button" onClick={onChangeCode}>
            Enter a different code
          </button>
        </section>
      )
    }
    // The host sets the guest's language when they join, so the first copy of the room already has it.
    if (room === null || room.guestKnows === null) {
      return (
        <p className="waiting" role="status">
          Connected. Waiting for the host…
        </p>
      )
    }

    const { guestKnows, round } = room

    const pair = learningPair(room.hostKnows, guestKnows)
    if (round === null) {
      const { review } = room
      return (
        <>
          <PlayerChips pair={pair} languages={languages} me={2} />
          {review === null ? (
            <p className="waiting" role="status">
              Waiting for the host to choose a topic…
            </p>
          ) : (
            <RoundPreview
              me={2}
              review={review}
              topicLabel={topicName(staticSource, review.topic)}
              languages={languages}
              onConfirm={confirm}
              onRegenerate={regenerate}
            />
          )}
        </>
      )
    }

    const { game } = round
    const myTurn = game.status === 'playing' && game.turns[game.index].player === 2
    return (
      <>
        <PlayerChips pair={pair} languages={languages} me={2} />
        <p className="topic">Topic: {topicName(staticSource, round.topic)}</p>
        <TurnView game={game} languages={languages} canAct={myTurn} onNext={nextTurn} onReveal={reveal} />
      </>
    )
  }

  const step = room === null || room.guestKnows === null ? 1 : room.round === null ? 2 : 3

  return (
    <>
      <StepIndicator current={step} />
      {renderBody()}
      <div className="actions">
        <button type="button" className="secondary" onClick={onLeave}>
          Leave game
        </button>
      </div>
    </>
  )
}
