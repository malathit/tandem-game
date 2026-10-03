import type { ContentSource, LanguageCode, LanguagePair, Sentence } from '../content/types'

export interface Turn {
  player: 1 | 2
  /** Written in the player's native language. */
  sentence: Sentence
  /** The language the player translates into, i.e. the one they are learning. */
  learning: LanguageCode
}

export const SENTENCES_PER_PLAYER = 2

export type Shuffle = <T>(items: readonly T[]) => T[]

/** Fisher-Yates shuffle that returns a new array. */
export const shuffled: Shuffle = (items) => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Builds the turns of one round, alternating Player 1 and Player 2.
 * `pair` is [language Player 1 is learning, language Player 2 is learning], so
 * Player 1 reads sentences in `pair[1]` (their native language) and vice versa.
 * The round is as long as the shorter of the two sentence lists allows.
 */
export function buildTurns(
  pair: LanguagePair,
  topicId: string,
  source: ContentSource,
  shuffle: Shuffle = shuffled,
): Turn[] {
  const [learnedByPlayer1, learnedByPlayer2] = pair
  const forPlayer1 = shuffle(source.getSentences(learnedByPlayer2, topicId))
  const forPlayer2 = shuffle(source.getSentences(learnedByPlayer1, topicId))
  const perPlayer = Math.min(SENTENCES_PER_PLAYER, forPlayer1.length, forPlayer2.length)

  return Array.from({ length: perPlayer }).flatMap((_, i): Turn[] => [
    { player: 1, sentence: forPlayer1[i], learning: learnedByPlayer1 },
    { player: 2, sentence: forPlayer2[i], learning: learnedByPlayer2 },
  ])
}
