import { useState } from 'react'
import { LocalGame } from './components/LocalGame'
import { ModeSelect } from './components/ModeSelect'
import { OnlineGame } from './components/OnlineGame'
import { staticSource } from './content/staticSource'
import type { Network } from './online/network'
import { peerNetwork } from './online/peerNetwork'

const languages = staticSource.getLanguages()

interface AppProps {
  /** How two-device games connect; tests pass a fake. */
  network?: Network
}

function App({ network = peerNetwork }: AppProps) {
  const [mode, setMode] = useState<'local' | 'online' | null>(null)
  const exit = () => setMode(null)

  return (
    <main>
      <header className="app-header">
        <h1>
          <span aria-hidden="true">💬</span> Tandem Game
        </h1>
        <p>Learn a language together, one sentence at a time.</p>
      </header>
      {mode === null && <ModeSelect onChoose={setMode} />}
      {mode === 'local' && <LocalGame languages={languages} onExit={exit} />}
      {mode === 'online' && <OnlineGame network={network} languages={languages} onExit={exit} />}
    </main>
  )
}

export default App
