import { useEffect, useState, type ReactNode } from 'react'
import { Spinner } from './Spinner'

/** How long a wait takes before it is called slow. */
export const SLOW_AFTER_MS = 10_000

interface WaitingProps {
  /** What is being waited for. */
  children: ReactNode
  /** Said, with whatever `actions` offer, once the wait is taking longer than usual. */
  slow?: ReactNode
  actions?: ReactNode
  slowAfterMs?: number
}

/** A wait the player cannot speed up: it moves so it is not mistaken for a frozen page, and says so when it drags on. */
export function Waiting({ children, slow, actions, slowAfterMs = SLOW_AFTER_MS }: WaitingProps) {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), slowAfterMs)
    return () => clearTimeout(timer)
  }, [slowAfterMs])

  return (
    <div className="waiting" role="status">
      <Spinner />
      <p>{children}</p>
      {isSlow && slow !== undefined && <p className="waiting-slow">{slow}</p>}
      {isSlow && actions}
    </div>
  )
}
