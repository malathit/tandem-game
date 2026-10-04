import { useState } from 'react'

const STEPS = [
  {
    title: 'Welcome to Tandem Game',
    body: [
      "Learn each other's language, one sentence at a time. You practise speaking, so the game never scores you.",
      'An AI writes sentences on a topic you choose, in your own language. Say each one aloud in the language you are learning, then tap “Show translation” to check yourself, or skip it.',
    ],
  },
  {
    title: 'On your own or with a partner',
    body: [
      'Practise on your own, or play with a partner on their own device: you speak their language and they speak yours. One of you creates a game and shares its link or code, and your partner tells you if it sounds right.',
      'Stay on a call or sit together: translations are spoken, not typed.',
      'Next you pick the languages you speak and learn. They are saved in this browser, and you can change them any time with “Settings”.',
    ],
  },
] as const

interface TutorialProps {
  /** Called when the player reaches the end, or skips the tutorial. */
  onDone: () => void
}

/** What a first-time visitor sees before anything else: what the game is and how a round goes. */
export function Tutorial({ onDone }: TutorialProps) {
  const [index, setIndex] = useState(0)
  const { title, body } = STEPS[index]
  const isLast = index === STEPS.length - 1

  return (
    <section className="card tutorial">
      <p className="turn-count">
        Step {index + 1} of {STEPS.length}
      </p>
      <h2>{title}</h2>
      {body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <button type="button" className="primary" onClick={isLast ? onDone : () => setIndex(index + 1)}>
        {isLast ? 'Choose my languages' : 'Next'}
      </button>
      {index > 0 && (
        <button type="button" onClick={() => setIndex(index - 1)}>
          Back
        </button>
      )}
      {!isLast && (
        <button type="button" className="secondary" onClick={onDone}>
          Skip tutorial
        </button>
      )}
    </section>
  )
}
