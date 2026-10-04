import type { Language } from '../content/types'
import type { GenerationErrorKind } from '../generation/types'
import type { ReviewState } from '../online/protocol'
import { Waiting } from './Waiting'
import { allowanceResetTime } from '../generation/allowanceReset'
import { Spinner } from './Spinner'

interface RoundPreviewProps {
  /** The player this device belongs to; they only review the sentences they will read. */
  me: 1 | 2
  review: Pick<ReviewState, 'turns' | 'busy' | 'error' | 'confirmed'>
  /** The readable name of the topic. */
  topicLabel: string
  languages: Language[]
  onConfirm: () => void
  onRegenerate: () => void
  /** Only the host can stop a running request or go back to the topics. */
  onCancel?: () => void
  onBack?: () => void
}

const PROBLEMS: Record<GenerationErrorKind, () => string> = {
  unavailable: () => "The AI service can't be reached right now.",
  'limit-reached': () => `The free AI allowance is used up for today. It resets at ${allowanceResetTime()} your time.`,
  invalid: () => "The AI didn't give usable sentences this time.",
  cancelled: () => '',
}

/** Each player checks the sentences they will read aloud, in their own language, before the round starts. */
export function RoundPreview({ me, review, topicLabel, languages, onConfirm, onRegenerate, onCancel, onBack }: RoundPreviewProps) {
  const { busy, error, confirmed } = review
  const turns = review.turns.filter((turn) => turn.player === me)
  const hasSentences = turns.length > 0
  const nameOf = (code: string) => languages.find((language) => language.code === code)?.name ?? code
  const iConfirmed = confirmed[me - 1]
  const partnerConfirmed = confirmed[me === 1 ? 1 : 0]

  return (
    <section className="card">
      <h2>{hasSentences ? 'Review your sentences' : 'Getting your sentences ready'}</h2>
      <p>Topic: {topicLabel}</p>

      {busy && (
        <Waiting slow={`The AI is taking longer than usual.${onCancel ? ' You can wait, or cancel and try again.' : ''}`}>
          Generating {hasSentences ? 'new ' : ''}sentences…
        </Waiting>
      )}

      {hasSentences && (
        <>
          <ol className="preview-list">
            {turns.map((turn) => (
              <li key={turn.sentence.id} data-player={turn.player}>
                <span className="preview-who">You translate into {nameOf(turn.learning)}</span>
                {turn.sentence.text}
              </li>
            ))}
          </ol>
          <p className="preview-source">
            Written by AI, so they can contain mistakes. Check that yours sound right, and ask for new ones if something
            looks off.
          </p>
        </>
      )}

      {error !== null && (
        <p className="notice" role="alert">
          {PROBLEMS[error]()}{' '}
          {hasSentences
            ? 'You can try again or confirm these sentences.'
            : onBack
              ? 'Try again or choose another topic.'
              : 'Try again, or wait for the host to choose another topic.'}
        </p>
      )}

      {!busy && iConfirmed && !partnerConfirmed && (
        <p className="status-line" role="status">
          <Spinner /> Waiting for your partner to confirm their sentences…
        </p>
      )}
      {!busy && !iConfirmed && partnerConfirmed && <p role="status">Your partner has confirmed their sentences.</p>}

      {hasSentences && (
        <button type="button" className="primary" disabled={busy || iConfirmed} onClick={onConfirm}>
          Looks good
        </button>
      )}
      {busy ? (
        onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )
      ) : (
        <button type="button" onClick={onRegenerate}>
          {hasSentences ? 'Regenerate with AI' : 'Try again'}
        </button>
      )}
      {onBack && (
        <button type="button" className="secondary" onClick={onBack}>
          Choose another topic
        </button>
      )}
    </section>
  )
}
