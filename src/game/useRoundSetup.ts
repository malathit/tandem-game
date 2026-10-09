import { useCallback, useEffect, useRef, useState } from 'react'
import { staticSource } from '../content/staticSource'
import type { ContentSource, LanguagePair } from '../content/types'
import { GenerationError, generateForLanguage, generateForPair, type SentenceGenerator } from '../generation/generator'
import { DEFAULT_ROUND_OPTIONS, type GenerateTopic, type GenerationErrorKind, type RoundOptions } from '../generation/types'
import { buildSoloTurns, buildTurns, type Turn } from './buildTurns'

export type RoundSetup =
  /** Picking a topic. */
  | { phase: 'choosing' }
  /** Reviewing the sentences of the round before it starts. */
  | {
      phase: 'preview'
      topic: GenerateTopic
      options: RoundOptions
      turns: Turn[]
      /** An AI request is running. */
      busy: boolean
      error: GenerationErrorKind | null
    }

const choosing: RoundSetup = { phase: 'choosing' }

interface RoundSetupOptions {
  /** One player: only sentences in their own language are written, and every turn is theirs. */
  solo?: boolean
  source?: ContentSource
  /** Called instead of showing the sentences when the round's options say not to review them. */
  onSkipReview?: (topic: GenerateTopic, turns: Turn[]) => void
}

/**
 * The host's side of starting a round: pick a topic, review the AI's sentences (unless `options.review` is off),
 * optionally ask for new ones.
 * `pair` is null until the partner has joined, and nothing can be chosen before then.
 * With `solo`, `pair` is [what the player learns, what they speak] and there is no partner.
 */
export function useRoundSetup(
  pair: LanguagePair | null,
  generator: SentenceGenerator | undefined,
  { solo = false, source = staticSource, onSkipReview }: RoundSetupOptions = {},
) {
  const [state, setState] = useState<RoundSetup>(choosing)
  // The request that may still change the state; aborting it makes its result count for nothing.
  const current = useRef<AbortController | null>(null)
  const skipReview = useRef(onSkipReview)
  useEffect(() => {
    skipReview.current = onSkipReview
  })

  const stop = useCallback(() => {
    current.current?.abort()
    current.current = null
  }, [])
  useEffect(() => stop, [stop])

  const run = useCallback(
    async (topic: GenerateTopic, options: RoundOptions, fresh: boolean) => {
      if (!generator || pair === null) return
      stop()
      const mine = new AbortController()
      current.current = mine
      try {
        const turns = solo
          ? buildSoloTurns(
              pair[0],
              await generateForLanguage(generator, pair[1], topic, fresh, options, mine.signal),
              options.count,
            )
          : buildTurns(pair, await generateForPair(generator, pair, topic, fresh, options, mine.signal), options.count)
        if (mine.signal.aborted) return
        if (!options.review && skipReview.current) {
          setState(choosing)
          skipReview.current(topic, turns)
          return
        }
        setState({
          phase: 'preview',
          topic,
          options,
          turns,
          busy: false,
          error: null,
        })
      } catch (error) {
        if (mine.signal.aborted) return
        const kind = error instanceof GenerationError ? error.kind : 'unavailable'
        setState((previous) => (previous.phase === 'preview' ? { ...previous, busy: false, error: kind } : previous))
      } finally {
        if (current.current === mine) current.current = null
      }
    },
    [generator, pair, solo, stop],
  )

  /** `topic` is a preset's id or the text the host typed. `fresh` skips sentences the Worker has already stored. */
  const choose = useCallback(
    (topic: string, options: RoundOptions = DEFAULT_ROUND_OPTIONS, fresh = false) => {
      if (!generator || pair === null) return
      const isPreset = source.getTopics().some((preset) => preset.id === topic)
      const chosen: GenerateTopic = isPreset ? { kind: 'preset', id: topic } : { kind: 'custom', text: topic }
      setState({ phase: 'preview', topic: chosen, options, turns: [], busy: true, error: null })
      void run(chosen, options, fresh)
    },
    [generator, pair, run, source],
  )

  /** Ask the AI for a new set of sentences for the topic being previewed. */
  const regenerate = useCallback(() => {
    if (!generator || state.phase !== 'preview' || state.busy) return
    setState({ ...state, busy: true, error: null })
    void run(state.topic, state.options, true)
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
