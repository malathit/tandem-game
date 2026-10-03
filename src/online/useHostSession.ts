import { useEffect, useReducer, useRef, useState } from 'react'
import type { LanguageCode } from '../content/types'
import type { Connection, Network, Room } from './network'
import { parseGuestMessage, type RoomState } from './protocol'
import { createRoom, roomReducer, type RoomEvent } from './roomReducer'

export interface HostSession {
  status: 'opening' | 'ready' | 'error'
  /** The code the partner types in; null until the room is open. */
  code: string | null
  room: RoomState
  partnerConnected: boolean
  /** For the host's own actions; the guest's messages are handled internally. */
  dispatch: (event: RoomEvent) => void
}

/**
 * Opens a room and keeps it in sync with the guest. The host holds the real
 * game state; the guest sends requests and gets a full copy after every change.
 * Only one guest can be connected at a time.
 */
export function useHostSession(network: Network, hostLearning: LanguageCode): HostSession {
  const [room, dispatch] = useReducer(roomReducer, hostLearning, createRoom)
  const [status, setStatus] = useState<HostSession['status']>('opening')
  const [code, setCode] = useState<string | null>(null)
  const [partnerConnected, setPartnerConnected] = useState(false)
  const guest = useRef<Connection | null>(null)

  useEffect(() => {
    let cancelled = false
    let openRoom: Room | null = null

    function accept(connection: Connection) {
      if (guest.current) {
        connection.close() // the room is full
        return
      }
      guest.current = connection
      connection.onMessage((raw) => {
        const message = parseGuestMessage(raw)
        if (message?.type === 'hello') {
          dispatch({ type: 'GUEST_HELLO', learning: message.learning })
        } else if (message?.type === 'next-turn') {
          dispatch({ type: 'NEXT_TURN', from: 2 })
        } else if (message?.type === 'reveal') {
          dispatch({ type: 'REVEAL', from: 2 })
        }
      })
      connection.onClose(() => {
        if (guest.current === connection) {
          guest.current = null
          setPartnerConnected(false)
        }
      })
      setPartnerConnected(true)
    }

    network.createRoom().then(
      (opened) => {
        if (cancelled) {
          opened.close()
          return
        }
        openRoom = opened
        opened.onConnection(accept)
        setCode(opened.code)
        setStatus('ready')
      },
      () => {
        if (!cancelled) setStatus('error')
      },
    )

    return () => {
      cancelled = true
      guest.current?.close()
      guest.current = null
      openRoom?.close()
    }
  }, [network])

  // Send the guest a full copy whenever the state changes or the guest (re)connects.
  useEffect(() => {
    if (partnerConnected) guest.current?.send({ type: 'state', state: room })
  }, [room, partnerConnected])

  return { status, code, room, partnerConnected, dispatch }
}
