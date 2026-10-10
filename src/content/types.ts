export const LANGUAGE_CODES = ['en', 'de'] as const

export type LanguageCode = (typeof LANGUAGE_CODES)[number]

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  LANGUAGE_CODES.some((code) => code === value)

export interface Language {
  code: LanguageCode
  name: string
}

export interface Topic {
  id: string
  name: string
}

export interface Sentence {
  id: string
  text: string
  /** The same sentence in the language the speaker translates into. */
  translation: string
}

export type LanguagePair = readonly [LanguageCode, LanguageCode]

/** What a player reads their sentences in, and what they translate them into. */
export interface PlayerLanguages {
  knows: LanguageCode
  learns: LanguageCode
}

/** The two players of a game: [Player 1, Player 2]. */
export type Players = readonly [PlayerLanguages, PlayerLanguages]

/** What screens need to know about the game's content: its languages and preset topics. */
export interface ContentSource {
  getLanguages(): Language[]
  getTopics(): Topic[]
}
