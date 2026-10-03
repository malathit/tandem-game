import type { LanguageCode } from '../content/types'

/** Sentences asked for per language: what one player reads in a round. */
export const SENTENCE_COUNT = 2

export type GenerateTopic = { kind: 'preset'; id: string } | { kind: 'custom'; text: string }

export interface GenerateRequest {
  /** The language the sentences are written in. */
  language: LanguageCode
  topic: GenerateTopic
  /** Skip stored sentences and ask the AI for new ones. */
  fresh: boolean
}

export interface GenerateResponse {
  sentences: string[]
}

export type GenerationErrorKind =
  /** The service is down or unreachable. */
  | 'unavailable'
  /** The free daily allowance is used up. */
  | 'limit-reached'
  /** The service answered, but not with usable sentences. */
  | 'invalid'
  | 'cancelled'
