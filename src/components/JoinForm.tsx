import { useState } from 'react'
import { normalizeRoomCode } from '../online/roomCode'

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
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value)
            setInvalid(false)
          }}
        />
      </label>
      {invalid && <p role="alert">A game code has 5 characters: letters and the numbers 2 to 9.</p>}
      <button type="submit" className="primary" disabled={value.trim() === ''}>
        Join game
      </button>
    </form>
  )
}
