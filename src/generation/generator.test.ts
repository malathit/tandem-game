// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createHttpGenerator, generateForPair, GenerationError, type SentenceGenerator } from './generator'
import type { GenerateRequest, GenerationErrorKind } from './types'

const URL = 'https://worker.example/'
const request: GenerateRequest = { language: 'de', topic: { kind: 'preset', id: 'weather' }, fresh: false }
const sentences = ['Ich kann gut schwimmen.', 'Er muss seine Hausaufgaben machen.']

type FetchFn = typeof fetch
const answer = (body: unknown, status = 200) =>
  Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }))

const kindOf = async (promise: Promise<unknown>): Promise<GenerationErrorKind | 'resolved'> => {
  try {
    await promise
    return 'resolved'
  } catch (error) {
    if (error instanceof GenerationError) return error.kind
    throw error
  }
}

describe('createHttpGenerator', () => {
  it('posts the request as JSON, without cookies, and returns the sentences', async () => {
    const fetchFn = vi.fn<FetchFn>(() => answer({ sentences }))
    const result = await createHttpGenerator(URL, { fetch: fetchFn }).generate(request)
    expect(result).toEqual(sentences)

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(URL)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual(request)
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(init?.credentials).toBe('omit')
  })

  describe('maps what went wrong to an error kind', () => {
    const kindFor = (response: () => Promise<Response>) =>
      kindOf(createHttpGenerator(URL, { fetch: response }).generate(request))

    it('429 means the free allowance is used up', async () => {
      expect(await kindFor(() => answer({ error: 'limit-reached' }, 429))).toBe('limit-reached')
    })

    it('server errors and a service that cannot be reached mean unavailable', async () => {
      expect(await kindFor(() => answer({ error: 'unavailable' }, 502))).toBe('unavailable')
      expect(await kindFor(() => answer({ error: 'unavailable' }, 503))).toBe('unavailable')
      expect(await kindFor(() => answer('<html>Bad gateway</html>', 500))).toBe('unavailable')
      expect(await kindFor(() => Promise.reject(new TypeError('Failed to fetch')))).toBe('unavailable')
    })

    it('the service giving up on bad output, or refusing the request, means invalid', async () => {
      expect(await kindFor(() => answer({ error: 'invalid' }, 502))).toBe('invalid')
      expect(await kindFor(() => answer({ error: 'bad-request' }, 400))).toBe('invalid')
      expect(await kindFor(() => answer({ error: 'forbidden' }, 403))).toBe('invalid')
    })
  })

  describe('does not trust a 200 answer', () => {
    const kindFor = (body: unknown) => kindOf(createHttpGenerator(URL, { fetch: () => answer(body) }).generate(request))

    it('rejects wrong counts, wrong languages and markup', async () => {
      expect(await kindFor({ sentences: [sentences[0]] })).toBe('invalid')
      expect(await kindFor({ sentences: ['You are very annoying', 'I do not like you'] })).toBe('invalid')
      expect(await kindFor({ sentences: ['Ich sehe <b>gut</b> aus.', sentences[1]] })).toBe('invalid')
    })

    it('rejects answers that are not the expected JSON', async () => {
      expect(await kindFor('not json')).toBe('invalid')
      expect(await kindFor({})).toBe('invalid')
      expect(await kindFor(null)).toBe('invalid')
      expect(await kindFor({ sentences: 'Ich kann schwimmen.' })).toBe('invalid')
    })

    it('rejects an oversized answer', async () => {
      expect(await kindFor({ sentences, padding: 'x'.repeat(10_000) })).toBe('invalid')
    })

    it('does not return extra fields from the answer', async () => {
      const result = await createHttpGenerator(URL, { fetch: () => answer({ sentences, extra: 'x' }) }).generate(request)
      expect(result).toEqual(sentences)
    })
  })

  describe('timeout and cancel', () => {
    /** A fetch that never answers, but rejects like the real one when aborted. */
    const hanging = (): FetchFn => (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })

    it('gives up after the timeout and reports unavailable', async () => {
      const generator = createHttpGenerator(URL, { fetch: hanging(), timeoutMs: 20 })
      expect(await kindOf(generator.generate(request))).toBe('unavailable')
    })

    it('stops the request itself when it times out', async () => {
      let seen: AbortSignal | null | undefined
      const fetchFn: FetchFn = (_url, init) => {
        seen = init?.signal
        return hanging()(_url, init)
      }
      await kindOf(createHttpGenerator(URL, { fetch: fetchFn, timeoutMs: 20 }).generate(request))
      expect(seen?.aborted).toBe(true)
    })

    it('reports cancelled, and stops the request, when the caller cancels mid-flight', async () => {
      const controller = new AbortController()
      let seen: AbortSignal | null | undefined
      const fetchFn: FetchFn = (url, init) => {
        seen = init?.signal
        return hanging()(url, init)
      }
      const pending = createHttpGenerator(URL, { fetch: fetchFn, timeoutMs: 5000 }).generate(request, controller.signal)
      controller.abort()
      expect(await kindOf(pending)).toBe('cancelled')
      expect(seen?.aborted).toBe(true)
    })

    it('does not call the service when already cancelled', async () => {
      const fetchFn = vi.fn<FetchFn>(() => answer({ sentences }))
      const controller = new AbortController()
      controller.abort()
      expect(await kindOf(createHttpGenerator(URL, { fetch: fetchFn }).generate(request, controller.signal))).toBe('cancelled')
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it('ignores a cancel that comes after the answer', async () => {
      const controller = new AbortController()
      const generator = createHttpGenerator(URL, { fetch: () => answer({ sentences }) })
      expect(await generator.generate(request, controller.signal)).toEqual(sentences)
      expect(() => controller.abort()).not.toThrow()
    })

    it('does not leave a timer running after an answer', async () => {
      vi.useFakeTimers()
      try {
        await createHttpGenerator(URL, { fetch: () => answer({ sentences }), timeoutMs: 20_000 }).generate(request)
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})

describe('generateForPair', () => {
  const pair = ['en', 'de'] as const
  const german = ['Ich kann gut schwimmen.', 'Er muss seine Hausaufgaben machen.']
  const english = ['She can swim very well.', 'They should try harder today.']
  const topic = { kind: 'custom', text: 'my pet dragon' } as const

  const generatorOf = (handler: (request: GenerateRequest, signal?: AbortSignal) => Promise<string[]>): SentenceGenerator => ({
    generate: handler,
  })

  it('asks for both languages of the pair and returns them as sentences', async () => {
    const asked: GenerateRequest[] = []
    const generator = generatorOf(async (req) => {
      asked.push(req)
      return req.language === 'de' ? german : english
    })
    const result = await generateForPair(generator, pair, topic, true)

    expect(asked.map((req) => req.language).sort()).toEqual(['de', 'en'])
    expect(asked.every((req) => req.fresh && req.topic === topic)).toBe(true)
    expect(result.de?.map((s) => s.text)).toEqual(german)
    expect(result.en?.map((s) => s.text)).toEqual(english)
  })

  it('gives every sentence its own id', async () => {
    const generator = generatorOf(async (req) => (req.language === 'de' ? german : english))
    const result = await generateForPair(generator, pair, topic, false)
    const ids = [...(result.de ?? []), ...(result.en ?? [])].map((s) => s.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('fails with the error of whichever language failed, and cancels the other request', async () => {
    let otherSignal: AbortSignal | undefined
    const generator = generatorOf((req, signal) => {
      if (req.language === 'de') return Promise.reject(new GenerationError('limit-reached'))
      otherSignal = signal
      return new Promise<string[]>(() => {})
    })
    expect(await kindOf(generateForPair(generator, pair, topic, false))).toBe('limit-reached')
    expect(otherSignal?.aborted).toBe(true)
  })

  it('cancels both requests when the caller cancels', async () => {
    const signals: AbortSignal[] = []
    const generator = generatorOf(
      (_req, signal) =>
        new Promise<string[]>((_resolve, reject) => {
          if (signal) signals.push(signal)
          signal?.addEventListener('abort', () => reject(new GenerationError('cancelled')))
        }),
    )
    const controller = new AbortController()
    const pending = generateForPair(generator, pair, topic, false, controller.signal)
    controller.abort()
    expect(await kindOf(pending)).toBe('cancelled')
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('does not ask at all when already cancelled', async () => {
    const generate = vi.fn(async () => german)
    const controller = new AbortController()
    controller.abort()
    expect(await kindOf(generateForPair({ generate }, pair, topic, false, controller.signal))).toBe('cancelled')
    expect(generate).not.toHaveBeenCalled()
  })
})
