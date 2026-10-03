import type { LanguageCode } from '../content/types'

/** How many sentences one player reads in a round: the host's choice, and what a round has unless they choose. */
export const MIN_COUNT = 1
export const MAX_COUNT = 5
export const DEFAULT_COUNT = 2

export type GenerateTopic = { kind: 'preset'; id: string } | { kind: 'custom'; text: string }

/** What the host chooses for a round. */
export interface RoundOptions {
  /** How many sentences each player reads, from `MIN_COUNT` to `MAX_COUNT`. */
  count: number
  /** Also write each sentence's translation into the other language. */
  translate: boolean
}

export const DEFAULT_ROUND_OPTIONS: RoundOptions = { count: DEFAULT_COUNT, translate: false }

export interface GenerateRequest extends RoundOptions {
  /** The language the sentences are written in. */
  language: LanguageCode
  topic: GenerateTopic
  /** Skip stored sentences and ask the AI for new ones. */
  fresh: boolean
}

/** What the generator hands back: the sentences, and with `translate` their translations in the same order. */
export interface GeneratedSentences {
  sentences: string[]
  translations?: string[]
}

/**
 * Why generating failed:
 * - `unavailable`: the service is down or unreachable.
 * - `limit-reached`: the free daily allowance is used up.
 * - `invalid`: the service answered, but not with usable sentences.
 * - `cancelled`: the request was stopped on purpose.
 */
export const GENERATION_ERROR_KINDS = ['unavailable', 'limit-reached', 'invalid', 'cancelled'] as const

export type GenerationErrorKind = (typeof GENERATION_ERROR_KINDS)[number]
