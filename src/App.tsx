import { OnlineGame } from './components/OnlineGame'
import { staticSource } from './content/staticSource'
import type { Network } from './online/network'
import { peerNetwork } from './online/peerNetwork'

const languages = staticSource.getLanguages()

interface AppProps {
  /** How devices connect; tests pass a fake. */
  network?: Network
}

function App({ network = peerNetwork }: AppProps) {
  return (
    <main>
      <header className="app-header">
        <h1>
          <span aria-hidden="true">💬</span> Tandem Game
        </h1>
        <p>Learn a language together, one sentence at a time.</p>
      </header>
      <OnlineGame network={network} languages={languages} />
    </main>
  )
}

export default App
