import { useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { Language } from '../content/types'
import type { SentenceGenerator } from '../generation/generator'
import type { Network } from '../online/network'
import { GuestRoom } from './GuestRoom'
import { HostRoom } from './HostRoom'
import { HostSetup, type HostSettings } from './HostSetup'
import { JoinForm } from './JoinForm'
import { SoloGame } from './SoloGame'

type Stage =
  | { kind: 'mode' }
  | { kind: 'solo-setup' }
  | { kind: 'solo'; settings: HostSettings }
  | { kind: 'menu' }
  | { kind: 'host-setup' }
  | { kind: 'host'; settings: HostSettings }
  | { kind: 'join-setup' }
  | { kind: 'guest'; code: string; attempt: number }

interface OnlineGameProps {
  network: Network
  languages: Language[]
  /** A valid game code from an invite link: join that game straight away. */
  initialCode?: string
  /** Where AI sentences come from; leave out to play only the hand-written topics. */
  generator?: SentenceGenerator
}

/** Walks the players from creating or joining a game, through to playing it. */
export function OnlineGame({ network, languages, initialCode, generator }: OnlineGameProps) {
  const [stage, setStage] = useState<Stage>(
    initialCode ? { kind: 'guest', code: initialCode, attempt: 1 } : { kind: 'mode' },
  )
  // Leaving a two-player game, or backing out of its screens, returns to the create-or-join menu.
  const toMenu = () => setStage({ kind: 'menu' })
  const toMode = () => setStage({ kind: 'mode' })

  switch (stage.kind) {
    case 'mode':
      return (
        <section className="card">
          <h2>Start a game</h2>
          <p>Practise on your own, or with a partner. You say your translations out loud.</p>
          <button type="button" className="primary" onClick={() => setStage({ kind: 'solo-setup' })}>
            1 player
          </button>
          <button type="button" onClick={toMenu}>
            2 players
          </button>
        </section>
      )

    case 'solo-setup':
      return (
        <HostSetup
          languages={languages}
          topics={staticSource.getTopics()}
          onCreate={(settings) => setStage({ kind: 'solo', settings })}
          onBack={toMode}
          solo
        />
      )

    case 'solo':
      return <SoloGame languages={languages} settings={stage.settings} generator={generator} onLeave={toMode} />

    case 'menu':
      return (
        <section className="card">
          <h2>Play with a partner</h2>
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
          <button type="button" className="secondary" onClick={toMode}>
            Back
          </button>
        </section>
      )

    case 'host-setup':
      return (
        <HostSetup
          languages={languages}
          topics={staticSource.getTopics()}
          onCreate={(settings) => setStage({ kind: 'host', settings })}
          onBack={toMenu}
        />
      )

    case 'host':
      return (
        <HostRoom
          network={network}
          languages={languages}
          hostKnows={stage.settings.knows}
          firstRound={stage.settings}
          generator={generator}
          onLeave={toMenu}
        />
      )

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
          onLeave={toMenu}
        />
      )
  }
}
