import { useState } from 'react'

const STEPS = [
  {
    title: 'Welcome to Tandem Game',
    body: [
      "Learn each other's language, one sentence at a time.",
      'You practise speaking: the game gives you sentences, and you say them aloud in the language you are learning.',
    ],
  },
  {
    title: 'How a round works',
    body: [
      'An AI writes sentences on a topic you choose. Each one is shown in your own language.',
      'Say it aloud in the language you are learning. Then tap “Show translation” to check yourself, or skip it.',
      'Nothing is scored: the game is for practice, not for points.',
    ],
  },
  {
    title: 'Playing with a partner',
    body: [
      'Practise on your own, or with a partner who speaks the language you are learning, while you speak theirs.',
      'One of you creates a game and shares its link or code. You take turns, and your partner tells you if it sounds right.',
      'Stay on a call or sit together: translations are spoken, not typed.',
    ],
  },
  {
    title: 'First, your settings',
    body: [
      'Next you choose the language you speak, the language you are learning, how many sentences a round has and how hard they are.',
      'They are saved in this browser, and you can change them any time with “Settings” on the first screen.',
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
      <progress value={index + 1} max={STEPS.length} aria-hidden="true" />
      <h2>{title}</h2>
      {body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <button type="button" className="primary" onClick={isLast ? onDone : () => setIndex(index + 1)}>
        {isLast ? 'Set my settings' : 'Next'}
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
