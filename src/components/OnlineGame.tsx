import { useState } from 'react'
import type { Language, LanguageCode } from '../content/types'
import type { Network } from '../online/network'
import { GuestRoom } from './GuestRoom'
import { HostRoom } from './HostRoom'
import { JoinForm } from './JoinForm'
import { LanguagePicker } from './LanguagePicker'

type Stage =
  | { kind: 'menu' }
  | { kind: 'host-setup' }
  | { kind: 'host'; learning: LanguageCode }
  | { kind: 'join-setup' }
  | { kind: 'guest'; code: string; attempt: number }

interface OnlineGameProps {
  network: Network
  languages: Language[]
  /** Leaves two-device play and returns to the start screen. */
  onExit: () => void
}

export function OnlineGame({ network, languages, onExit }: OnlineGameProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'menu' })
  const toMenu = () => setStage({ kind: 'menu' })

  switch (stage.kind) {
    case 'menu':
      return (
        <section className="card">
          <h2>Play on two devices</h2>
          <p>
            One of you creates a game and shares its code, and the other joins with it. You say your
            translations out loud, so stay on a call or sit together.
          </p>
          <button type="button" className="primary" onClick={() => setStage({ kind: 'host-setup' })}>
            Create a game
          </button>
          <button type="button" onClick={() => setStage({ kind: 'join-setup' })}>
            Join a game
          </button>
          <button type="button" className="secondary" onClick={onExit}>
            Back
          </button>
        </section>
      )

    case 'host-setup':
      return (
        <section className="card">
          <h2>Create a game</h2>
          <LanguagePicker
            languages={languages}
            label="I am learning"
            submitLabel="Create game"
            onSubmit={(learning) => setStage({ kind: 'host', learning })}
          />
          <button type="button" className="secondary" onClick={toMenu}>
            Back
          </button>
        </section>
      )

    case 'host':
      return <HostRoom network={network} languages={languages} hostLearning={stage.learning} onLeave={onExit} />

    case 'join-setup':
      return (
        <section className="card">
          <h2>Join a game</h2>
          <JoinForm onJoin={(code) => setStage({ kind: 'guest', code, attempt: 1 })} />
          <button type="button" className="secondary" onClick={toMenu}>
            Back
          </button>
        </section>
      )

    case 'guest':
      return (
        <GuestRoom
          // A new key makes React start a fresh connection attempt.
          key={stage.attempt}
          network={network}
          languages={languages}
          code={stage.code}
          onRetry={() => setStage({ ...stage, attempt: stage.attempt + 1 })}
          onChangeCode={() => setStage({ kind: 'join-setup' })}
          onLeave={onExit}
        />
      )
  }
}
