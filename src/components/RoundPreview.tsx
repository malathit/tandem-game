import type { Language } from '../content/types'
import type { GenerationErrorKind } from '../generation/types'
import type { RoundSetup } from '../game/useRoundSetup'

type Preview = Extract<RoundSetup, { phase: 'preview' }>

interface RoundPreviewProps {
  setup: Preview
  /** The readable name of the topic. */
  topicLabel: string
  languages: Language[]
  onStart: () => void
  onRegenerate: () => void
  onCancel: () => void
  onBack: () => void
}

const PROBLEMS: Record<GenerationErrorKind, string> = {
  unavailable: "The AI service can't be reached right now.",
  'limit-reached': 'The free AI allowance is used up for today. It resets at midnight UTC.',
  invalid: "The AI didn't give usable sentences this time.",
  cancelled: '',
}

/** The host reviews the sentences of the round, and may ask the AI for new ones, before starting. */
export function RoundPreview({ setup, topicLabel, languages, onStart, onRegenerate, onCancel, onBack }: RoundPreviewProps) {
  const { turns, busy, error } = setup
  const hasSentences = turns.length > 0
  const nameOf = (code: string) => languages.find((language) => language.code === code)?.name ?? code

  return (
    <section className="card">
      <h2>Review the sentences</h2>
      <p>Topic: {topicLabel}</p>

      {busy && (
        <p className="waiting" role="status">
          Generating {hasSentences ? 'new ' : ''}sentences…
        </p>
      )}

      {hasSentences && (
        <>
          <ol className="preview-list">
            {turns.map((turn) => (
              <li key={`${turn.player}-${turn.sentence.id}`} data-player={turn.player}>
                <span className="preview-who">
                  Player {turn.player} translates into {nameOf(turn.learning)}
                </span>
                {turn.sentence.text}
              </li>
            ))}
          </ol>
          <p className="preview-source">
            Written by AI, so they can contain mistakes. Regenerate if something looks off.
          </p>
        </>
      )}

      {error !== null && (
        <p className="notice" role="alert">
          {PROBLEMS[error]} {hasSentences ? 'You can try again or start with these sentences.' : 'Try again or choose another topic.'}
        </p>
      )}

      {hasSentences && (
        <button type="button" className="primary" disabled={busy} onClick={onStart}>
          Start round
        </button>
      )}
      {busy ? (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      ) : (
        <button type="button" onClick={onRegenerate}>
          {hasSentences ? 'Regenerate with AI' : 'Try again'}
        </button>
      )}
      <button type="button" className="secondary" onClick={onBack}>
        Choose another topic
      </button>
    </section>
  )
}
