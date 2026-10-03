import { useState } from 'react'
import { LanguageSetup } from './components/LanguageSetup'
import { staticSource } from './content/staticSource'
import type { LanguagePair } from './content/types'

const languages = staticSource.getLanguages()

const nameOf = (code: string) => languages.find((l) => l.code === code)?.name ?? code

function App() {
  // null means "languages not chosen yet", which decides the screen to show.
  const [pair, setPair] = useState<LanguagePair | null>(null)

  return (
    <main>
      <h1>Tandem Game</h1>
      {pair === null ? (
        <LanguageSetup languages={languages} onContinue={setPair} />
      ) : (
        <>
          <p>Player 1 is learning {nameOf(pair[0])}.</p>
          <p>Player 2 is learning {nameOf(pair[1])}.</p>
          <button type="button" onClick={() => setPair(null)}>
            Change languages
          </button>
        </>
      )}
    </main>
  )
}

export default App
