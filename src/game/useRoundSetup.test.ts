import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GenerationError, type SentenceGenerator } from '../generation/generator'
import type { GenerateRequest, GenerationErrorKind } from '../generation/types'
import { useRoundSetup } from './useRoundSetup'

// The host learns English, the guest German.
const pair = ['en', 'de'] as const
const german = ['Ich kann gut schwimmen.', 'Er muss seine Hausaufgaben machen.']
const english = ['She can swim very well.', 'They should try harder today.']

interface Pending {
  request: GenerateRequest
  signal?: AbortSignal
  resolve: (sentences: string[]) => void
  reject: (error: unknown) => void
}

/** A generator the test answers by hand, so it can look at the state while a request is in flight. */
function manualGenerator() {
  const pending: Pending[] = []
  const generator: SentenceGenerator = {
    generate: (request, signal) =>
      new Promise<string[]>((resolve, reject) => {
        pending.push({ request, signal, resolve, reject })
      }),
  }
  const answerAll = (lang: Record<string, string[]> = { de: german, en: english }) => {
    for (const p of pending.splice(0)) p.resolve(lang[p.request.language])
  }
  const failAll = (kind: GenerationErrorKind) => {
    for (const p of pending.splice(0)) p.reject(new GenerationError(kind))
  }
  return { generator, pending, answerAll, failAll }
}

const preset = 'modal-verbs'

describe('useRoundSetup', () => {
  it('starts by letting the host choose', () => {
    const { result } = renderHook(() => useRoundSetup(pair, manualGenerator().generator))
    expect(result.current.state).toEqual({ phase: 'choosing', notice: null })
  })

  it('does nothing until the partner has joined', () => {
    const { generator, pending } = manualGenerator()
    const { result } = renderHook(() => useRoundSetup(null, generator))
    act(() => result.current.choose(preset))
    act(() => result.current.choose('my pet dragon'))
    expect(result.current.state).toEqual({ phase: 'choosing', notice: null })
    expect(pending).toHaveLength(0)
  })

  describe('choosing a preset topic', () => {
    it('previews the hand-written sentences straight away, without asking the AI', () => {
      const { generator, pending } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))

      const { state } = result.current
      expect(state).toMatchObject({ phase: 'preview', topic: { kind: 'preset', id: preset }, fromAi: false, busy: false, error: null })
      if (state.phase !== 'preview') throw new Error('expected a preview')
      expect(state.turns.map((turn) => turn.player)).toEqual([1, 2, 1, 2])
      expect(pending).toHaveLength(0)
    })
  })

  describe('regenerating with the AI', () => {
    it('keeps showing the current sentences while it works, then swaps in the new ones', async () => {
      const { generator, pending, answerAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      const before = result.current.state.phase === 'preview' ? result.current.state.turns : []

      act(() => result.current.regenerate())
      expect(result.current.state).toMatchObject({ phase: 'preview', busy: true, turns: before })
      expect(pending.map((p) => p.request)).toEqual(
        expect.arrayContaining([
          { language: 'de', topic: { kind: 'preset', id: preset }, fresh: true },
          { language: 'en', topic: { kind: 'preset', id: preset }, fresh: true },
        ]),
      )

      act(() => answerAll())
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, fromAi: true }))
      const { state } = result.current
      if (state.phase !== 'preview') throw new Error('expected a preview')
      // Player 1 learns English, so reads German; Player 2 reads English.
      expect(state.turns.map((turn) => turn.sentence.text).sort()).toEqual([...german, ...english].sort())
    })

    it('keeps the previous sentences and reports why when it fails', async () => {
      const { generator, failAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      const before = result.current.state.phase === 'preview' ? result.current.state.turns : []

      act(() => result.current.regenerate())
      act(() => failAll('limit-reached'))
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: 'limit-reached' }))
      expect(result.current.state).toMatchObject({ turns: before, fromAi: false })
    })

    it('treats an unexpected failure as the service being unavailable', async () => {
      const generator: SentenceGenerator = { generate: () => Promise.reject(new Error('boom')) }
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      act(() => result.current.regenerate())
      await waitFor(() => expect(result.current.state).toMatchObject({ error: 'unavailable' }))
    })

    it('clears an earlier error when it tries again', async () => {
      const { generator, failAll, answerAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      act(() => result.current.regenerate())
      act(() => failAll('unavailable'))
      await waitFor(() => expect(result.current.state).toMatchObject({ error: 'unavailable' }))

      act(() => result.current.regenerate())
      expect(result.current.state).toMatchObject({ busy: true, error: null })
      act(() => answerAll())
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: null, fromAi: true }))
    })

    it('ignores a second request while one is running', () => {
      const { generator, pending } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      act(() => result.current.regenerate())
      act(() => result.current.regenerate())
      expect(pending).toHaveLength(2) // one per language, not four
    })

    it('does nothing without a generator', () => {
      const { result } = renderHook(() => useRoundSetup(pair, undefined))
      act(() => result.current.choose(preset))
      act(() => result.current.regenerate())
      expect(result.current.state).toMatchObject({ phase: 'preview', busy: false })
    })
  })

  describe('cancelling', () => {
    it('stops the request and keeps the current sentences, without an error', async () => {
      const { generator, pending } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      const before = result.current.state.phase === 'preview' ? result.current.state.turns : []
      act(() => result.current.regenerate())
      const signals = pending.map((p) => p.signal)

      act(() => result.current.cancel())
      expect(signals.every((signal) => signal?.aborted)).toBe(true)
      expect(result.current.state).toMatchObject({ phase: 'preview', busy: false, error: null, turns: before })
    })

    it('ignores an answer that arrives after cancelling', async () => {
      const { generator, answerAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
      const before = result.current.state
      act(() => result.current.regenerate())
      act(() => result.current.cancel())
      await act(async () => answerAll())
      expect(result.current.state).toEqual(before)
    })

    it('ignores a failure that arrives after cancelling', async () => {
      const { generator, failAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose(preset))
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
      expect(result.current.state).toEqual({ phase: 'choosing', notice: null })
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
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, fromAi: true }))
    })

    it('reports a failure with nothing to show, so the host can try again or choose another topic', async () => {
      const { generator, failAll } = manualGenerator()
      const { result } = renderHook(() => useRoundSetup(pair, generator))
      act(() => result.current.choose('my pet dragon'))
      act(() => failAll('invalid'))
      await waitFor(() => expect(result.current.state).toMatchObject({ busy: false, error: 'invalid', turns: [] }))
    })

    it('says so, without calling anything, when there is no generator', () => {
      const { result } = renderHook(() => useRoundSetup(pair, undefined))
      act(() => result.current.choose('my pet dragon'))
      expect(result.current.state).toEqual({ phase: 'choosing', notice: 'my pet dragon' })
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
      expect(result.current.state).toEqual({ phase: 'choosing', notice: null })
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
