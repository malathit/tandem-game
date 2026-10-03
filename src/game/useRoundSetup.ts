import { useCallback, useEffect, useRef, useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { ContentSource, LanguagePair } from '../content/types'
import { GenerationError, generateForPair, type SentenceGenerator } from '../generation/generator'
import type { GenerateTopic, GenerationErrorKind } from '../generation/types'
import { buildTurns, sentencesFor, type Turn } from './buildTurns'

export type RoundSetup =
  /** Picking a topic. `notice` is a typed topic that had no sentences. */
  | { phase: 'choosing'; notice: string | null }
  /** Reviewing the sentences of the round before it starts. */
  | {
      phase: 'preview'
      topic: GenerateTopic
      turns: Turn[]
      /** Whether the turns came from the AI, not from the hand-written sentences. */
      fromAi: boolean
      /** An AI request is running. */
      busy: boolean
      error: GenerationErrorKind | null
    }

const choosing: RoundSetup = { phase: 'choosing', notice: null }

/**
 * The host's side of starting a round: pick a topic, review its sentences, optionally ask the AI for new ones.
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
        setState({ phase: 'preview', topic, turns: buildTurns(pair, sentences), fromAi: true, busy: false, error: null })
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
      if (pair === null) return
      const isPreset = source.getTopics(pair).some((preset) => preset.id === topic)
      if (isPreset) {
        // The shuffle happens here, in an event handler, so it runs once per choice.
        const turns = buildTurns(pair, sentencesFor(source, pair, topic))
        setState(
          turns.length === 0
            ? { phase: 'choosing', notice: topic }
            : { phase: 'preview', topic: { kind: 'preset', id: topic }, turns, fromAi: false, busy: false, error: null },
        )
        return
      }
      if (!generator) {
        setState({ phase: 'choosing', notice: topic })
        return
      }
      const custom: GenerateTopic = { kind: 'custom', text: topic }
      setState({ phase: 'preview', topic: custom, turns: [], fromAi: false, busy: true, error: null })
      void run(custom, false)
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
