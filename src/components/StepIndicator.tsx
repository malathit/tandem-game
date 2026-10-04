const STEPS = ['Connect', 'Sentences', 'Play']

interface StepIndicatorProps {
  /** The number of the step the player is on, starting at 1. */
  current: number
  /** The steps' names; a game with no partner has no Connect step. */
  steps?: readonly string[]
}

export function StepIndicator({ current, steps = STEPS }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="steps">
        {steps.map((label, index) => {
          const number = index + 1
          const status = number < current ? 'done' : number === current ? 'current' : 'todo'
          return (
            <li
              key={label}
              className={`step step-${status}`}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              {label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
