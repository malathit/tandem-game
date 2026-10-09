import type { DataConnection, Peer } from 'peerjs'
import {
  NetworkError,
  type Connection,
  type Network,
  type NetworkFailure,
  type Room,
} from './network'
import { generateRoomCode } from './roomCode'

// Peer ids share one global namespace on the free PeerJS matchmaker, so ours get a prefix.
const ID_PREFIX = 'tandem-game-'
const TIMEOUT_MS = 10_000
const MAX_CODE_ATTEMPTS = 5

type PeerClass = typeof Peer

// Loaded on first use, so the start screen appears without waiting for PeerJS.
const loadPeer = async (): Promise<PeerClass> => (await import('peerjs')).Peer

function wrap(connection: DataConnection, dispose: () => void = () => {}): Connection {
  return {
    send: (message) => connection.send(message),
    onMessage(handler) {
      connection.on('data', handler)
      return () => connection.off('data', handler)
    },
    onClose(handler) {
      const onClose = () => {
        dispose()
        handler()
      }
      connection.on('close', onClose)
      return () => connection.off('close', onClose)
    },
    close() {
      connection.close()
      dispose()
    },
  }
}

function openRoom(PeerCtor: PeerClass, code: string): Promise<Room> {
  return new Promise((resolve, reject) => {
    const peer = new PeerCtor(ID_PREFIX + code)
    let opened = false
    const timer = setTimeout(() => fail(new Error('timeout')), TIMEOUT_MS)

    function fail(error: unknown) {
      // Once the room is open the code is already handed out, so a later error must not take it down.
      if (opened) return
      clearTimeout(timer)
      peer.destroy()
      reject(error)
    }

    peer.on('error', fail)
    // The matchmaker connection dropped; the code only works again once it is back.
    peer.on('disconnected', () => {
      if (opened && !peer.destroyed) peer.reconnect()
    })
    peer.on('open', () => {
      opened = true
      clearTimeout(timer)
      resolve({
        code,
        onConnection(handler) {
          const listener = (connection: DataConnection) => {
            if (connection.open) handler(wrap(connection))
            else connection.once('open', () => handler(wrap(connection)))
          }
          peer.on('connection', listener)
          return () => peer.off('connection', listener)
        },
        close: () => peer.destroy(),
      })
    })
  })
}

export const peerNetwork: Network = {
  async createRoom() {
    const PeerCtor = await loadPeer().catch(() => {
      throw new NetworkError('unavailable')
    })
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        return await openRoom(PeerCtor, generateRoomCode())
      } catch (error) {
        // Someone else already uses this code: try another. Anything else is fatal.
        const taken = String((error as { type?: unknown }).type) === 'unavailable-id'
        if (!taken) throw new NetworkError('unavailable')
      }
    }
    throw new NetworkError('unavailable')
  },

  async join(code) {
    const PeerCtor = await loadPeer().catch(() => {
      throw new NetworkError('unavailable')
    })
    return new Promise<Connection>((resolve, reject) => {
      const peer = new PeerCtor()
      let settled = false
      const timer = setTimeout(() => fail('unavailable'), TIMEOUT_MS)

      function fail(reason: NetworkFailure) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        peer.destroy()
        reject(new NetworkError(reason))
      }

      peer.on('error', (error) =>
        fail(String(error.type) === 'peer-unavailable' ? 'not-found' : 'unavailable'),
      )
      peer.on('open', () => {
        const connection = peer.connect(ID_PREFIX + code, { reliable: true })
        connection.on('error', () => fail('unavailable'))
        connection.on('open', () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(wrap(connection, () => peer.destroy()))
        })
      })
    })
  },
}
