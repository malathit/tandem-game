import type { LanguageCode, LanguagePair, Sentence } from '../content/types'
import type { SentencesByLanguage } from '../game/buildTurns'
import type { GenerateRequest, GenerateTopic, GeneratedSentences, GenerationErrorKind, GenerationOptions } from './types'
import { parseTranslatedOutput } from './validate'

const DEFAULT_TIMEOUT_MS = 20_000
/** A real answer is at most a few thousand characters (5 sentences with translations); anything far bigger is not from our Worker. */
const MAX_RESPONSE_CHARS = 8192

export class GenerationError extends Error {
  readonly kind: GenerationErrorKind

  constructor(kind: GenerationErrorKind) {
    super(`Sentence generation failed: ${kind}`)
    this.name = 'GenerationError'
    this.kind = kind
  }
}

/** Where generated sentences come from. Rejects with a `GenerationError`. */
export interface SentenceGenerator {
  generate(request: GenerateRequest, signal?: AbortSignal): Promise<GeneratedSentences>
}

interface HttpOptions {
  fetch?: typeof fetch
  timeoutMs?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function failureKind(status: number, text: string): GenerationErrorKind {
  if (status === 429) return 'limit-reached'
  if (status === 400 || status === 403 || status === 413) return 'invalid'
  if (status >= 500) {
    try {
      const body: unknown = JSON.parse(text)
      if (isRecord(body) && body.error === 'invalid') return 'invalid'
    } catch {
      // not our Worker's JSON: the service is simply down
    }
  }
  return 'unavailable'
}

/** Re-checks an answer with the same rules as the Worker; it must carry the translations. */
function checked(body: Record<string, unknown>, { language, count }: GenerateRequest): GeneratedSentences {
  const { sentences, translations } = body
  if (!Array.isArray(sentences) || !Array.isArray(translations)) throw new GenerationError('invalid')
  const pairs = sentences.map((text, i) => ({ text, translation: translations[i] }))
  const parsed = parseTranslatedOutput(pairs, language, count)
  if (!parsed.ok) throw new GenerationError('invalid')
  return { sentences: parsed.sentences, translations: parsed.translations }
}

/** Calls the Worker over HTTP and re-checks everything it sends back. */
export function createHttpGenerator(
  url: string,
  { fetch: fetchFn = (...args) => globalThis.fetch(...args), timeoutMs = DEFAULT_TIMEOUT_MS }: HttpOptions = {},
): SentenceGenerator {
  return {
    async generate(request, signal) {
      if (signal?.aborted) throw new GenerationError('cancelled')

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const cancel = () => controller.abort()
      signal?.addEventListener('abort', cancel, { once: true })

      let status: number
      let text: string
      try {
        const response = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal,
        })
        status = response.status
        text = await response.text()
      } catch {
        throw new GenerationError(signal?.aborted ? 'cancelled' : 'unavailable')
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', cancel)
      }

      if (status !== 200) throw new GenerationError(failureKind(status, text))
      if (text.length > MAX_RESPONSE_CHARS) throw new GenerationError('invalid')

      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        throw new GenerationError('invalid')
      }
      if (!isRecord(body) || !Array.isArray(body.sentences)) throw new GenerationError('invalid')
      return checked(body, request)
    },
  }
}

/** Generates the sentences of one language: the one request every round is made of. */
export async function generateForLanguage(
  generator: SentenceGenerator,
  language: LanguageCode,
  topic: GenerateTopic,
  fresh: boolean,
  options: GenerationOptions,
  signal?: AbortSignal,
): Promise<Sentence[]> {
  if (signal?.aborted) throw new GenerationError('cancelled')
  const { sentences, translations } = await generator.generate(
    { language, topic, fresh, count: options.count, difficulty: options.difficulty },
    signal,
  )
  return sentences.map((text, i) => ({
    id: `ai-${language}-${i + 1}`,
    text,
    translation: translations[i],
  }))
}

/**
 * Generates the sentences for both languages of a round at the same time.
 * If one language fails, the other request is cancelled and that error is thrown.
 */
export async function generateForPair(
  generator: SentenceGenerator,
  pair: LanguagePair,
  topic: GenerateTopic,
  fresh: boolean,
  options: GenerationOptions,
  signal?: AbortSignal,
): Promise<SentencesByLanguage> {
  if (signal?.aborted) throw new GenerationError('cancelled')

  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    const entries = await Promise.all(
      pair.map(async (language) => {
        try {
          return [language, await generateForLanguage(generator, language, topic, fresh, options, controller.signal)] as const
        } catch (error) {
          controller.abort()
          throw error
        }
      }),
    )
    return Object.fromEntries(entries)
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}
