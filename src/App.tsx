import { useEffect, useState } from 'react'
import { OnlineGame } from './components/OnlineGame'
import { staticSource } from './content/staticSource'
import { readJoinCode } from './online/inviteLink'
import type { Network } from './online/network'
import { peerNetwork } from './online/peerNetwork'

const languages = staticSource.getLanguages()

interface AppProps {
  /** How devices connect; tests pass a fake. */
  network?: Network
}

function App({ network = peerNetwork }: AppProps) {
  // Read once on load: opening an invite link joins that game.
  const [inviteCode] = useState(() => readJoinCode(window.location.search))

  // Take the code out of the address bar so a refresh or a copied address does
  // not silently try to rejoin an old game.
  useEffect(() => {
    if (inviteCode) window.history.replaceState(null, '', window.location.pathname)
  }, [inviteCode])

  return (
    <main>
      <header className="app-header">
        <h1>
          <span aria-hidden="true">💬</span> Tandem Game
        </h1>
        <p>Learn a language together, one sentence at a time.</p>
      </header>
      <OnlineGame network={network} languages={languages} initialCode={inviteCode ?? undefined} />
    </main>
  )
}

export default App
