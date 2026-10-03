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
}

export type LanguagePair = readonly [LanguageCode, LanguageCode]

/** What screens need to know about the game's content: its languages and preset topics. */
export interface ContentSource {
  getLanguages(): Language[]
  getTopics(): Topic[]
}
