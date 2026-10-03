import {
  NetworkError,
  type Connection,
  type Network,
  type Room,
  type Unsubscribe,
} from '../online/network'
import { generateRoomCode } from '../online/roomCode'

interface Endpoint extends Connection {
  peer?: Endpoint
  receive(message: unknown): void
  closedByPeer(): void
}

// Delivery is asynchronous and messages are copied, like on a real network.
function createEndpoint(): Endpoint {
  const messageHandlers = new Set<(message: unknown) => void>()
  const closeHandlers = new Set<() => void>()
  let closed = false

  const subscribe = <T>(handlers: Set<T>, handler: T): Unsubscribe => {
    handlers.add(handler)
    return () => handlers.delete(handler)
  }

  const endpoint: Endpoint = {
    send(message) {
      if (closed) return
      const copy: unknown = JSON.parse(JSON.stringify(message))
      queueMicrotask(() => endpoint.peer?.receive(copy))
    },
    onMessage: (handler) => subscribe(messageHandlers, handler),
    onClose: (handler) => subscribe(closeHandlers, handler),
    close() {
      if (closed) return
      closed = true
      queueMicrotask(() => endpoint.peer?.closedByPeer())
    },
    receive(message) {
      if (!closed) messageHandlers.forEach((handler) => handler(message))
    },
    closedByPeer() {
      if (closed) return
      closed = true
      closeHandlers.forEach((handler) => handler())
    },
  }
  return endpoint
}

export interface MemoryNetwork extends Network {
  /** When true, every call fails as if the matchmaking service were down. */
  unavailable: boolean
  /** The host's end of each connection to a room, e.g. to simulate a guest dropping. */
  connectionsTo(code: string): Connection[]
}

export function createMemoryNetwork(): MemoryNetwork {
  const hostEnds = new Map<string, Set<Endpoint>>()
  const listeners = new Map<string, Set<(connection: Connection) => void>>()

  const network: MemoryNetwork = {
    unavailable: false,

    createRoom() {
      if (network.unavailable) return Promise.reject(new NetworkError('unavailable'))
      let code = generateRoomCode()
      while (hostEnds.has(code)) code = generateRoomCode()
      hostEnds.set(code, new Set())
      listeners.set(code, new Set())

      const room: Room = {
        code,
        onConnection(handler) {
          listeners.get(code)?.add(handler)
          return () => listeners.get(code)?.delete(handler)
        },
        close() {
          hostEnds.get(code)?.forEach((end) => end.close())
          hostEnds.delete(code)
          listeners.delete(code)
        },
      }
      return Promise.resolve(room)
    },

    join(code) {
      if (network.unavailable) return Promise.reject(new NetworkError('unavailable'))
      const ends = hostEnds.get(code)
      if (!ends) return Promise.reject(new NetworkError('not-found'))

      const host = createEndpoint()
      const guest = createEndpoint()
      host.peer = guest
      guest.peer = host
      ends.add(host)
      queueMicrotask(() => listeners.get(code)?.forEach((handler) => handler(host)))
      return Promise.resolve(guest)
    },

    connectionsTo: (code) => [...(hostEnds.get(code) ?? [])],
  }
  return network
}
