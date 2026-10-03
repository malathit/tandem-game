export type LanguageCode = 'en' | 'de'

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

/**
 * Where the game gets its sentences from. Screens depend on this interface
 * only, so a different source (e.g. AI-generated) can replace the static one
 * without touching any component.
 */
export interface ContentSource {
  getLanguages(): Language[]
  /** Topics that have sentences in both languages of the pair. */
  getTopics(pair: LanguagePair): Topic[]
  /** Sentences written in `language` for the topic; empty if there are none. */
  getSentences(language: LanguageCode, topicId: string): Sentence[]
}
