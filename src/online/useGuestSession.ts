import { useCallback, useEffect, useRef, useState } from 'react'
import type { LanguageCode } from '../content/types'
import { NetworkError, type Connection, type Network } from './network'
import { parseHostMessage, type GuestMessage, type RoomState } from './protocol'

export interface GuestSession {
  status: 'connecting' | 'connected' | 'lost' | 'not-found' | 'unavailable'
  /** The host's latest copy of the game; null until the first one arrives. */
  room: RoomState | null
  chooseLanguage: (learning: LanguageCode) => void
  /** Says the sentences this player will read are fine. */
  confirm: () => void
  /** Asks the host for new sentences. */
  regenerate: () => void
  nextTurn: () => void
  reveal: () => void
}

/** Joins a room and shows whatever the host says the game looks like. */
export function useGuestSession(network: Network, code: string): GuestSession {
  const [status, setStatus] = useState<GuestSession['status']>('connecting')
  const [room, setRoom] = useState<RoomState | null>(null)
  const host = useRef<Connection | null>(null)

  useEffect(() => {
    let cancelled = false

    network.join(code).then(
      (connection) => {
        if (cancelled) {
          connection.close()
          return
        }
        host.current = connection
        connection.onMessage((raw) => {
          const message = parseHostMessage(raw)
          if (message) setRoom(message.state)
        })
        connection.onClose(() => {
          host.current = null
          if (!cancelled) setStatus('lost')
        })
        setStatus('connected')
      },
      (error: unknown) => {
        if (cancelled) return
        setStatus(error instanceof NetworkError && error.reason === 'not-found' ? 'not-found' : 'unavailable')
      },
    )

    return () => {
      cancelled = true
      host.current?.close()
      host.current = null
    }
  }, [network, code])

  const send = useCallback((message: GuestMessage) => host.current?.send(message), [])

  return {
    status,
    room,
    chooseLanguage: useCallback((learning) => send({ type: 'hello', learning }), [send]),
    confirm: useCallback(() => send({ type: 'confirm' }), [send]),
    regenerate: useCallback(() => send({ type: 'regenerate' }), [send]),
    nextTurn: useCallback(() => send({ type: 'next-turn' }), [send]),
    reveal: useCallback(() => send({ type: 'reveal' }), [send]),
  }
}
