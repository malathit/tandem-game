import { useCallback, useEffect, useRef, useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { ContentSource, LanguagePair } from '../content/types'
import { GenerationError, generateForPair, type SentenceGenerator } from '../generation/generator'
import type { GenerateTopic, GenerationErrorKind } from '../generation/types'
import { buildTurns, type Turn } from './buildTurns'

export type RoundSetup =
  /** Picking a topic. */
  | { phase: 'choosing' }
  /** Reviewing the sentences of the round before it starts. */
  | {
      phase: 'preview'
      topic: GenerateTopic
      turns: Turn[]
      /** An AI request is running. */
      busy: boolean
      error: GenerationErrorKind | null
    }

const choosing: RoundSetup = { phase: 'choosing' }

/**
 * The host's side of starting a round: pick a topic, review the AI's sentences, optionally ask for new ones.
 * `pair` is null until the partner has joined, and nothing can be chosen before then.
 */
export function useRoundSetup(
  pair: LanguagePair | null,
  generator: SentenceGenerator | undefined,
  source: ContentSource = staticSource,
) {
  const [state, setState] = useState<RoundSetup>(choosing)
  // The request that may still change the state; aborting it makes its result count for nothing.
  const current = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    current.current?.abort()
    current.current = null
  }, [])
  useEffect(() => stop, [stop])

  const run = useCallback(
    async (topic: GenerateTopic, fresh: boolean) => {
      if (!generator || pair === null) return
      stop()
      const mine = new AbortController()
      current.current = mine
      try {
        const sentences = await generateForPair(generator, pair, topic, fresh, mine.signal)
        if (mine.signal.aborted) return
        setState({ phase: 'preview', topic, turns: buildTurns(pair, sentences), busy: false, error: null })
      } catch (error) {
        if (mine.signal.aborted) return
        const kind = error instanceof GenerationError ? error.kind : 'unavailable'
        setState((previous) => (previous.phase === 'preview' ? { ...previous, busy: false, error: kind } : previous))
      } finally {
        if (current.current === mine) current.current = null
      }
    },
    [generator, pair, stop],
  )

  /** `topic` is a preset's id or the text the host typed. */
  const choose = useCallback(
    (topic: string) => {
      if (!generator || pair === null) return
      const isPreset = source.getTopics().some((preset) => preset.id === topic)
      const chosen: GenerateTopic = isPreset ? { kind: 'preset', id: topic } : { kind: 'custom', text: topic }
      setState({ phase: 'preview', topic: chosen, turns: [], busy: true, error: null })
      void run(chosen, false)
    },
    [generator, pair, run, source],
  )

  /** Ask the AI for a new set of sentences for the topic being previewed. */
  const regenerate = useCallback(() => {
    if (!generator || state.phase !== 'preview' || state.busy) return
    setState({ ...state, busy: true, error: null })
    void run(state.topic, true)
  }, [generator, run, state])

  /** Stop a running request; the host keeps what they had, or goes back to the topics if they had nothing. */
  const cancel = useCallback(() => {
    stop()
    setState((previous) => {
      if (previous.phase !== 'preview') return previous
      return previous.turns.length === 0 ? choosing : { ...previous, busy: false, error: null }
    })
  }, [stop])

  const back = useCallback(() => {
    stop()
    setState(choosing)
  }, [stop])

  return { state, choose, regenerate, cancel, back }
}
