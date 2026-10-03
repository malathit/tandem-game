import type { Language, LanguagePair } from '../content/types'

interface PlayerChipsProps {
  /** [language Player 1 is learning, language Player 2 is learning] */
  pair: LanguagePair
  languages: Language[]
  /** Marks which player this device belongs to, in two-device games. */
  me?: 1 | 2
}

export function PlayerChips({ pair, languages, me }: PlayerChipsProps) {
  const nameOf = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  return (
    <ul className="players">
      <li data-player="1">
        Player 1 is learning {nameOf(pair[0])}
        {me === 1 && ' (you)'}
      </li>
      <li data-player="2">
        Player 2 is learning {nameOf(pair[1])}
        {me === 2 && ' (you)'}
      </li>
    </ul>
  )
}
