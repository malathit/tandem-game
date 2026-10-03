import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkError, type Connection } from './network'
import { peerNetwork } from './peerNetwork'

// A stand-in for PeerJS: it records what the adapter does and lets tests trigger events.
const { FakePeer, FakeConnection } = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void

  class Emitter {
    handlers = new Map<string, Set<Handler>>()
    on(event: string, handler: Handler) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set())
      this.handlers.get(event)?.add(handler)
      return this
    }
    once(event: string, handler: Handler) {
      const wrapper: Handler = (...args) => {
        this.off(event, wrapper)
        handler(...args)
      }
      return this.on(event, wrapper)
    }
    off(event: string, handler: Handler) {
      this.handlers.get(event)?.delete(handler)
      return this
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.forEach((handler) => handler(...args))
    }
  }

  class FakeConnection extends Emitter {
    id: string | undefined // the peer id the adapter connected to
    open = false
    closed = false
    sent: unknown[] = []
    send(message: unknown) {
      this.sent.push(message)
    }
    close() {
      this.closed = true
    }
  }

  class FakePeer extends Emitter {
    static instances: FakePeer[] = []
    id: string | undefined
    destroyed = false
    connections: FakeConnection[] = []
    constructor(id?: string) {
      super()
      this.id = id
      FakePeer.instances.push(this)
    }
    connect(id: string) {
      const connection = new FakeConnection()
      this.connections.push(connection)
      connection.id = id
      return connection
    }
    destroy() {
      this.destroyed = true
    }
  }
  return { FakePeer, FakeConnection }
})

vi.mock('peerjs', () => ({ Peer: FakePeer }))

const lastPeer = () => FakePeer.instances[FakePeer.instances.length - 1]
const nextPeer = async (count: number) => {
  await vi.waitFor(() => expect(FakePeer.instances).toHaveLength(count))
  return FakePeer.instances[count - 1]
}

beforeEach(() => {
  FakePeer.instances.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('peerNetwork.createRoom', () => {
  it('opens a prefixed id on the matchmaker and returns the code', async () => {
    const pending = peerNetwork.createRoom()
    const peer = await nextPeer(1)
    peer.emit('open')
    const room = await pending

    expect(room.code).toMatch(/^[A-Z2-9]{5}$/)
    expect(peer.id).toBe(`tandem-game-${room.code}`)
  })

  it('tries another code when the first one is taken', async () => {
    const pending = peerNetwork.createRoom()
    const first = await nextPeer(1)
    first.emit('error', { type: 'unavailable-id' })
    const second = await nextPeer(2)
    second.emit('open')
    const room = await pending

    expect(first.destroyed).toBe(true)
    expect(second.id).toBe(`tandem-game-${room.code}`)
  })

  it('gives up with an "unavailable" error on any other failure', async () => {
    const pending = peerNetwork.createRoom()
    ;(await nextPeer(1)).emit('error', { type: 'network' })

    await expect(pending).rejects.toMatchObject({ reason: 'unavailable' })
    expect(FakePeer.instances).toHaveLength(1)
  })

  it('stops after a few taken codes', async () => {
    const pending = peerNetwork.createRoom()
    const settled = expect(pending).rejects.toBeInstanceOf(NetworkError)
    for (let attempt = 1; attempt <= 5; attempt++) {
      ;(await nextPeer(attempt)).emit('error', { type: 'unavailable-id' })
    }
    await settled
    expect(FakePeer.instances).toHaveLength(5)
  })

  it('gives up when the matchmaker never answers', async () => {
    vi.useFakeTimers()
    const pending = peerNetwork.createRoom()
    const settled = expect(pending).rejects.toMatchObject({ reason: 'unavailable' })
    await vi.advanceTimersByTimeAsync(0) // let the dynamic import finish
    await vi.advanceTimersByTimeAsync(10_000)
    await settled
    expect(lastPeer().destroyed).toBe(true)
  })

  it('hands over incoming connections once they are open and can stop listening', async () => {
    const pending = peerNetwork.createRoom()
    const peer = await nextPeer(1)
    peer.emit('open')
    const room = await pending

    const received: Connection[] = []
    const stop = room.onConnection((connection) => received.push(connection))

    const incoming = new FakeConnection()
    peer.emit('connection', incoming)
    expect(received).toHaveLength(0) // not open yet
    incoming.open = true
    incoming.emit('open')
    expect(received).toHaveLength(1)

    received[0].send({ hello: 1 })
    expect(incoming.sent).toEqual([{ hello: 1 }])

    stop()
    peer.emit('connection', new FakeConnection())
    expect(received).toHaveLength(1)
  })

  it('closes the peer when the room is closed', async () => {
    const pending = peerNetwork.createRoom()
    const peer = await nextPeer(1)
    peer.emit('open')
    ;(await pending).close()
    expect(peer.destroyed).toBe(true)
  })
})

describe('peerNetwork.join', () => {
  async function joined() {
    const pending = peerNetwork.join('K7QXZ')
    const peer = await nextPeer(1)
    peer.emit('open')
    const connection = peer.connections[0]
    connection.emit('open')
    return { peer, connection, joined: await pending }
  }

  it('connects to the prefixed id of the room', async () => {
    const { connection } = await joined()
    expect(connection.id).toBe('tandem-game-K7QXZ')
  })

  it('passes messages in both directions', async () => {
    const { connection, joined: guest } = await joined()
    const received: unknown[] = []
    guest.onMessage((message) => received.push(message))

    connection.emit('data', { type: 'state' })
    guest.send({ type: 'next-turn' })

    expect(received).toEqual([{ type: 'state' }])
    expect(connection.sent).toEqual([{ type: 'next-turn' }])
  })

  it('reports when the host goes away and then frees the peer', async () => {
    const { peer, connection, joined: guest } = await joined()
    const onClose = vi.fn()
    guest.onClose(onClose)
    connection.emit('close')

    expect(onClose).toHaveBeenCalledOnce()
    expect(peer.destroyed).toBe(true)
  })

  it('closes the connection and the peer when we leave', async () => {
    const { peer, connection, joined: guest } = await joined()
    guest.close()
    expect(connection.closed).toBe(true)
    expect(peer.destroyed).toBe(true)
  })

  it('says "not found" when no host has that code', async () => {
    const pending = peerNetwork.join('K7QXZ')
    ;(await nextPeer(1)).emit('error', { type: 'peer-unavailable' })

    await expect(pending).rejects.toMatchObject({ reason: 'not-found' })
    expect(lastPeer().destroyed).toBe(true)
  })

  it('says "unavailable" when the matchmaker fails', async () => {
    const pending = peerNetwork.join('K7QXZ')
    ;(await nextPeer(1)).emit('error', { type: 'server-error' })
    await expect(pending).rejects.toMatchObject({ reason: 'unavailable' })
  })

  it('says "unavailable" when the connection itself fails', async () => {
    const pending = peerNetwork.join('K7QXZ')
    const peer = await nextPeer(1)
    peer.emit('open')
    peer.connections[0].emit('error', new Error('ice failed'))
    await expect(pending).rejects.toMatchObject({ reason: 'unavailable' })
    expect(peer.destroyed).toBe(true)
  })

  it('gives up when the connection never opens', async () => {
    vi.useFakeTimers()
    const pending = peerNetwork.join('K7QXZ')
    const settled = expect(pending).rejects.toMatchObject({ reason: 'unavailable' })
    await vi.advanceTimersByTimeAsync(0)
    lastPeer().emit('open')
    await vi.advanceTimersByTimeAsync(10_000)
    await settled
    expect(lastPeer().destroyed).toBe(true)
  })
})
