import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GenerationError, type SentenceGenerator } from '../generation/generator'
import type { GeneratedSentences, GenerateRequest, GenerationErrorKind } from '../generation/types'
import { useRoundSetup } from './useRoundSetup'

// The host learns English, the guest German.
const pair = ['en', 'de'] as const
const german = ['Ich kann gut schwimmen.', 'Er muss seine Hausaufgaben machen.']
const english = ['She can swim very well.', 'They should try harder today.']

interface Pending {
  request: GenerateRequest
  signal?: AbortSignal
  resolve: (answer: GeneratedSentences) => void
  reject: (error: unknown) => void
}

/** A generator the test answers by hand, so it can look at the state while a request is in flight. */
function manualGenerator() {
  const pending: Pending[] = []
  const generator: SentenceGenerator = {
    generate: (request, signal) =>
      new Promise<GeneratedSentences>((resolve, reject) => {
        pending.push({ request, signal, resolve, reject })
      }),
  }
  const answerAll = (lang: Record<string, string[]> = { de: german, en: english }) => {
    for (const p of pending.splice(0)) p.resolve({ sentences: lang[p.request.language] })
  }
  const failAll = (kind: GenerationErrorKind) => {
    for (const p of pending.splice(0)) p.reject(new GenerationError(kind))
  }
  return { generator, pending, answerAll, failAll }
}

const preset = 'greetings'

/** A hook whose host has chosen the preset and been shown the AI's first sentences. */
async function previewing() {
  const manual = manualGenerator()
  const { result } = renderHook(() => useRoundSetup(pair, manual.generator))
  act(() => result.current.choose(preset))
  act(() => manual.answerAll())
  await waitFor(() => expect(result.current.state).toMatchObject({ phase: 'preview', busy: false }))
  return { ...manual, result }
}

/** A hook with nothing chosen yet. */
function start() {
  const manual = manualGenerator()
  const { result } = renderHook(() => useRoundSetup(pair, manual.generator))
  return { ...manual, result }
}

describe('useRoundSetup', () => {
  it('starts by letting the host choose', () => {
    const { result } = renderHook(() => useRoundSetup(pair, manualGenerator().generator))
    expect(result.current.state).toEqual({ phase: 'choosing' })
  })

  it('does nothing until the partner has joined', () => {
    const { generator, pending } = manualGenerator()
    const { result } = renderHook(() => useRoundSetup(null, generator))
    act(() => result.current.choose(preset))
    act(() => result.current.choose('my pet dragon'))
    expect(result.current.state).toEqual({ phase: 'choosing' })
    expect(pending).toHaveLength(0)
  })

  describe('choosing a preset topic', () => {
    it('asks the AI for both languages straight away and previews the result', async () => {
      const { generator, pending, answerAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))

      expect(result.current.state).toMatchObject({ phase: 'preview', topic: { kind: 'preset', id: preset }, busy: true, turns: [] })
      expect(pending.map((p) => [p.request.language, p.request.topic, p.request.fresh]).sort()).toEqual([
        ['de', { kind: 'preset', id: preset }, false],
        ['en', { kind: 'preset', id: preset }, false],
      ])

      act(() => answerAll())
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: null }))
      const { state } = result.current
      if (state.phase !== 'preview') throw new Error('expected a preview')
      expect(state.turns.map((turn) => turn.player)).toEqual([1, 2, 1, 2])
    })

    it('treats text that is not a preset id as a custom topic', () => {
      const { generator, pending } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose('greetings and more'))
      expect(result.current.state).toMatchObject({ topic: { kind: 'custom', text: 'greetings and more' } })
      expect(pending.every((p) => p.request.topic.kind === 'custom')).toBe(true)
    })

    it('does nothing without a generator', () => {
      const { result } = renderHook(() => useRoundSetup(pair, undefined))
      act(() => result.current.choose(preset))
      act(() => result.current.choose('my pet dragon'))
      expect(result.current.state).toEqual({ phase: 'choosing' })
    })
  })

  describe('round options', () => {
    it('asks for the chosen number of sentences and translations, and builds that many turns', async () => {
      const { result, pending } = start()
      act(() => result.current.choose(preset, { count: 1, translate: true }))
      expect(pending.map((p) => p.request)).toEqual(
        expect.arrayContaining([expect.objectContaining({ count: 1, translate: true })]),
      )
      act(() => {
        for (const p of pending.splice(0)) p.resolve({ sentences: [(p.request.language === 'de' ? german : english)[0]] })
      })
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false }))
      expect(result.current.state).toMatchObject({ options: { count: 1, translate: true } })
      expect(result.current.state.phase === 'preview' && result.current.state.turns).toHaveLength(2)
    })

    it('keeps the options when it asks for new sentences', async () => {
      const { result, pending } = start()
      act(() => result.current.choose(preset, { count: 3, translate: false }))
      act(() => pending.splice(0).forEach((p) => p.reject(new GenerationError('unavailable'))))
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: 'unavailable' }))
      act(() => result.current.regenerate())
      expect(pending.map((p) => p.request)).toEqual(
        expect.arrayContaining([expect.objectContaining({ count: 3, fresh: true })]),
      )
    })
  })

  describe('regenerating with the AI', () => {
    it('keeps showing the current sentences while it works, then swaps in the new ones', async () => {
      const { pending, answerAll, result } = await previewing()
      const before = result.current.state.phase === 'preview' ? result.current.state.turns : []

      act(() => result.current.regenerate())
      expect(result.current.state).toMatchObject({ phase: 'preview', busy: true, turns: before })
      expect(pending.map((p) => p.request)).toEqual(
        expect.arrayContaining([
          { language: 'de', topic: { kind: 'preset', id: preset }, fresh: true, count: 2, translate: false },
          { language: 'en', topic: { kind: 'preset', id: preset }, fresh: true, count: 2, translate: false },
        ]),
      )

      act(() => answerAll())
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false }))
      const { state } = result.current
      if (state.phase !== 'preview') throw new Error('expected a preview')
      // Player 1 learns English, so reads German; Player 2 reads English.
      expect(state.turns.map((turn) => turn.sentence.text).sort()).toEqual([...german, ...english].sort())
    })

    it('keeps the previous sentences and reports why when it fails', async () => {
      const { failAll, result } = await previewing()
      const before = result.current.state.phase === 'preview' ? result.current.state.turns : []

      act(() => result.current.regenerate())
      act(() => failAll('limit-reached'))
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: 'limit-reached' }))
      expect(result.current.state).toMatchObject({ turns: before })
    })

    it('treats an unexpected failure as the service being unavailable', async () => {
      const generator: SentenceGenerator = { generate: () => Promise.reject(new Error('boom')) }
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      await waitFor(() => expect(result.current.state).toMatchObject({ error: 'unavailable' }))
    })

    it('clears an earlier error when it tries again', async () => {
      const { failAll, answerAll, result } = await previewing()
      act(() => result.current.regenerate())
      act(() => failAll('unavailable'))
      await waitFor(() => expect(result.current.state).toMatchObject({ error: 'unavailable' }))

      act(() => result.current.regenerate())
      expect(result.current.state).toMatchObject({ busy: true, error: null })
      act(() => answerAll())
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: null }))
    })

    it('ignores a second request while one is running', async () => {
      const { pending, result } = await previewing()
      act(() => result.current.regenerate())
      act(() => result.current.regenerate())
      expect(pending).toHaveLength(2) // one per language, not four
    })
  })

  describe('cancelling', () => {
    it('stops the request and keeps the current sentences, without an error', async () => {
      const { pending, result } = await previewing()
      const before = result.current.state.phase === 'preview' ? result.current.state.turns : []
      act(() => result.current.regenerate())
      const signals = pending.map((p) => p.signal)

      act(() => result.current.cancel())
      expect(signals.every((signal) => signal?.aborted)).toBe(true)
      expect(result.current.state).toMatchObject({ phase: 'preview', busy: false, error: null, turns: before })
    })

    it('ignores an answer that arrives after cancelling', async () => {
      const { answerAll, result } = await previewing()
      const before = result.current.state
      act(() => result.current.regenerate())
      act(() => result.current.cancel())
      await act(async () => answerAll())
      expect(result.current.state).toEqual(before)
    })

    it('ignores a failure that arrives after cancelling', async () => {
      const { failAll, result } = await previewing()
      const before = result.current.state
      act(() => result.current.regenerate())
      act(() => result.current.cancel())
      await act(async () => failAll('cancelled'))
      expect(result.current.state).toEqual(before)
    })

    it('goes back to choosing when there is nothing to fall back on', () => {
      const { generator } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose('my pet dragon'))
      act(() => result.current.cancel())
      expect(result.current.state).toEqual({ phase: 'choosing' })
    })
  })

  describe('a custom topic', () => {
    it('generates straight away and previews the result', async () => {
      const { generator, pending, answerAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose('my pet dragon'))
      expect(result.current.state).toMatchObject({
        phase: 'preview', topic: { kind: 'custom', text: 'my pet dragon' }, busy: true, turns: [],
      })
      expect(pending.map((p) => p.request.fresh)).toEqual([false, false])

      act(() => answerAll())
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false }))
    })

    it('reports a failure with nothing to show, so the host can try again or choose another topic', async () => {
      const { generator, failAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose('my pet dragon'))
      act(() => failAll('invalid'))
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: 'invalid', turns: [] }))
    })
  })

  describe('leaving', () => {
    it('back() stops any request and returns to choosing', () => {
      const { generator, pending } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      act(() => result.current.regenerate())
      act(() => result.current.back())
      expect(pending.every((p) => p.signal?.aborted)).toBe(true)
      expect(result.current.state).toEqual({ phase: 'choosing' })
    })

    it('stops the request when the screen goes away', () => {
      const { generator, pending } = manualGenerator()
      const { result, unmount } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      act(() => result.current.regenerate())
      unmount()
      expect(pending.every((p) => p.signal?.aborted)).toBe(true)
    })

    it('does not update after unmounting when a late answer arrives', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { generator, answerAll } = manualGenerator()
      const { result, unmount } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      act(() => result.current.regenerate())
      unmount()
      await act(async () => answerAll())
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })
  })
})
