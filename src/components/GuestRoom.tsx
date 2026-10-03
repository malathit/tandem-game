import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import { topicName } from '../game/topicName'
import type { Network } from '../online/network'
import { useGuestSession, type GuestSession } from '../online/useGuestSession'
import { LanguagePicker } from './LanguagePicker'
import { PlayerChips } from './PlayerChips'
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
  const { status, room, chooseLanguage, nextTurn, reveal } = useGuestSession(network, code)

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
    if (room === null) {
      return (
        <p className="waiting" role="status">
          Connected. Waiting for the host…
        </p>
      )
    }

    const { guestLearning, round } = room
    if (guestLearning === null) {
      const hostLanguage = languages.find((l) => l.code === room.hostLearning)?.name ?? room.hostLearning
      return (
        <section className="card">
          <h2>You're in!</h2>
          <p>Your partner is learning {hostLanguage}. Which language are you learning?</p>
          <LanguagePicker
            languages={languages}
            label="I am learning"
            submitLabel="Continue"
            exclude={room.hostLearning}
            onSubmit={chooseLanguage}
          />
        </section>
      )
    }

    const pair = [room.hostLearning, guestLearning] as const
    if (round === null) {
      return (
        <>
          <PlayerChips pair={pair} languages={languages} me={2} />
          <p className="waiting" role="status">
            Waiting for the host to choose a topic…
          </p>
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

  const step = room === null || room.guestLearning === null ? 1 : room.round === null ? 2 : 3

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
