import { useState } from 'react'

interface InviteLinkProps {
  url: string
}

export function InviteLink({ url }: InviteLinkProps) {
  const [copyResult, setCopyResult] = useState<'copied' | 'failed' | null>(null)
  // Phones and some browsers have a native share sheet; elsewhere we only offer copying.
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopyResult('copied')
    } catch {
      // Clipboard access can be missing (e.g. on an insecure page) or refused.
      setCopyResult('failed')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Tandem Game', text: 'Join my Tandem Game', url })
    } catch {
      // The player closed the share sheet; nothing to report.
    }
  }

  return (
    <div className="invite">
      <label>
        Invite link
        <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
      </label>
      <div className="invite-actions">
        <button type="button" className="primary" onClick={copy}>
          Copy invite link
        </button>
        {canShare && (
          <button type="button" onClick={share}>
            Share
          </button>
        )}
      </div>
      {copyResult === 'copied' && <p role="status">Link copied.</p>}
      {copyResult === 'failed' && (
        <p role="alert">Couldn't copy the link. Select it above and copy it by hand.</p>
      )}
    </div>
  )
}
