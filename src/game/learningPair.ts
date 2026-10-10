import type { LanguagePair, Players } from '../content/types'

/** What each player translates into: [what Player 1 learns, what Player 2 learns]. */
export const learningPair = ([first, second]: Players): LanguagePair => [first.learns, second.learns]
