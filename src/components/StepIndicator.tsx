const STEPS = ['Connect', 'Review', 'Play'] as const

interface StepIndicatorProps {
  current: 1 | 2 | 3
}

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="steps">
        {STEPS.map((label, index) => {
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
