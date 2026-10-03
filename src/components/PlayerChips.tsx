import type { Language, LanguagePair } from '../content/types'

interface PlayerChipsProps {
  /** [language Player 1 is learning, language Player 2 is learning] */
  pair: LanguagePair
  languages: Language[]
  /** Which player this device belongs to; they are described as "you", the other as "your partner". */
  me: 1 | 2
}

export function PlayerChips({ pair, languages, me }: PlayerChipsProps) {
  const nameOf = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  // Each device describes the players from its own point of view, so nobody has to work out their number.
  const describe = (player: 1 | 2) => `${player === me ? 'You are' : 'Your partner is'} learning ${nameOf(pair[player - 1])}`
  return (
    <ul className="players">
      <li data-player="1">{describe(1)}</li>
      <li data-player="2">{describe(2)}</li>
    </ul>
  )
}
