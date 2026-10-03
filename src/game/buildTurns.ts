import type { ContentSource, LanguageCode, LanguagePair, Sentence } from '../content/types'

export interface Turn {
  player: 1 | 2
  /** Written in the player's native language. */
  sentence: Sentence
  /** The language the player translates into, i.e. the one they are learning. */
  learning: LanguageCode
}

export const SENTENCES_PER_PLAYER = 2

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

/** The sentences of both languages in `pair` for one topic of a content source. */
export function sentencesFor(
  source: ContentSource,
  pair: LanguagePair,
  topicId: string,
): SentencesByLanguage {
  return Object.fromEntries(pair.map((language) => [language, source.getSentences(language, topicId)]))
}

/**
 * Builds the turns of one round, alternating Player 1 and Player 2.
 * `pair` is [language Player 1 is learning, language Player 2 is learning], so
 * Player 1 reads sentences in `pair[1]` (their native language) and vice versa.
 * The round is as long as the shorter of the two sentence lists allows.
 */
export function buildTurns(
  pair: LanguagePair,
  sentences: SentencesByLanguage,
  shuffle: Shuffle = shuffled,
): Turn[] {
  const [learnedByPlayer1, learnedByPlayer2] = pair
  const forPlayer1 = shuffle(sentences[learnedByPlayer2] ?? [])
  const forPlayer2 = shuffle(sentences[learnedByPlayer1] ?? [])
  const perPlayer = Math.min(SENTENCES_PER_PLAYER, forPlayer1.length, forPlayer2.length)

  return Array.from({ length: perPlayer }).flatMap((_, i): Turn[] => [
    { player: 1, sentence: forPlayer1[i], learning: learnedByPlayer1 },
    { player: 2, sentence: forPlayer2[i], learning: learnedByPlayer2 },
  ])
}
