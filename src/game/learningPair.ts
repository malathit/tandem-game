import type { LanguageCode, LanguagePair } from '../content/types'

/** Each player learns the language their partner speaks: [what Player 1 learns, what Player 2 learns]. */
export const learningPair = (hostKnows: LanguageCode, guestKnows: LanguageCode): LanguagePair => [guestKnows, hostKnows]
