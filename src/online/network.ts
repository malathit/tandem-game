export type Unsubscribe = () => void

/** A live link to one other device. Messages are plain JSON-compatible values. */
export interface Connection {
  send(message: unknown): void
  onMessage(handler: (message: unknown) => void): Unsubscribe
  /** Called when the other side goes away. Not called for our own close(). */
  onClose(handler: () => void): Unsubscribe
  close(): void
}

/** An open game on the host's device that other devices can connect to. */
export interface Room {
  readonly code: string
  onConnection(handler: (connection: Connection) => void): Unsubscribe
  close(): void
}

export type NetworkFailure = 'not-found' | 'unavailable'

export class NetworkError extends Error {
  readonly reason: NetworkFailure

  constructor(reason: NetworkFailure) {
    super(reason)
    this.reason = reason
  }
}

/**
 * How devices find and talk to each other. The game only depends on this
 * interface, so PeerJS can be swapped for another transport (or a fake in tests).
 */
export interface Network {
  createRoom(): Promise<Room>
  /** Rejects with a NetworkError if there is no such room or it cannot be reached. */
  join(code: string): Promise<Connection>
}
