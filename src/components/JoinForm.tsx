import { useState } from 'react'
import { CODE_LENGTH, normalizeRoomCode } from '../online/roomCode'

interface JoinFormProps {
  /** Called with a valid, normalised game code. */
  onJoin: (code: string) => void
}

export function JoinForm({ onJoin }: JoinFormProps) {
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = normalizeRoomCode(value)
    if (code === null) {
      setInvalid(true)
    } else {
      onJoin(code)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Game code
        <input
          value={value}
          maxLength={CODE_LENGTH + 4}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => {
            // A code has no spaces or dashes, so show what will be sent.
            setValue(e.target.value.replace(/[\s-]/g, ''))
            setInvalid(false)
          }}
        />
      </label>
      <p className="hint">
        Ask the person who created the game for its {CODE_LENGTH}-digit code, or open their invite link.{' '}
        <span aria-hidden="true">{value.length} of {CODE_LENGTH} digits typed.</span>
      </p>
      {invalid && <p role="alert">A game code has {CODE_LENGTH} digits, with no letters.</p>}
      <button type="submit" className="primary" disabled={value.trim() === ''}>
        Join game
      </button>
    </form>
  )
}
