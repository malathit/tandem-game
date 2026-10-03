import type { LanguageCode, LanguagePair, Sentence } from '../content/types'
import { DEFAULT_COUNT } from '../generation/types'

export interface Turn {
  player: 1 | 2
  /** Written in the player's native language. */
  sentence: Sentence
  /** The language the player translates into, i.e. the one they are learning. */
  learning: LanguageCode
}

/** Sentences available for a round, by the language they are written in. */
export type SentencesByLanguage = Partial<Record<LanguageCode, readonly Sentence[]>>

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
 * `pair` is [language Player 1 is learning, language Player 2 is learning] (see `learningPair`), so
 * Player 1 reads sentences in `pair[1]` (their native language) and vice versa.
 * Each player gets `perPlayer` turns, fewer if a sentence list is shorter.
 */
export function buildTurns(
  pair: LanguagePair,
  sentences: SentencesByLanguage,
  perPlayer: number = DEFAULT_COUNT,
  shuffle: Shuffle = shuffled,
): Turn[] {
  const [learnedByPlayer1, learnedByPlayer2] = pair
  const forPlayer1 = shuffle(sentences[learnedByPlayer2] ?? [])
  const forPlayer2 = shuffle(sentences[learnedByPlayer1] ?? [])
  const turnsEach = Math.min(perPlayer, forPlayer1.length, forPlayer2.length)

  return Array.from({ length: turnsEach }).flatMap((_, i): Turn[] => [
    { player: 1, sentence: forPlayer1[i], learning: learnedByPlayer1 },
    { player: 2, sentence: forPlayer2[i], learning: learnedByPlayer2 },
  ])
}

/**
 * Builds the turns of a solo round: every turn is Player 1's, reading `sentences` (written in their native language)
 * and translating into `learning`. Gives `count` turns, fewer if there are fewer sentences.
 */
export function buildSoloTurns(
  learning: LanguageCode,
  sentences: readonly Sentence[],
  count: number = DEFAULT_COUNT,
  shuffle: Shuffle = shuffled,
): Turn[] {
  return shuffle(sentences)
    .slice(0, count)
    .map((sentence) => ({ player: 1, sentence, learning }))
}
