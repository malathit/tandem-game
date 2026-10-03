interface ModeSelectProps {
  onChoose: (mode: 'local' | 'online') => void
}

export function ModeSelect({ onChoose }: ModeSelectProps) {
  return (
    <section className="card">
      <h2>How do you want to play?</h2>
      <p>Take turns on one device, or each use your own phone or computer.</p>
      <button type="button" className="primary" onClick={() => onChoose('local')}>
        Play on this device
      </button>
      <button type="button" onClick={() => onChoose('online')}>
        Play on two devices
      </button>
    </section>
  )
}
