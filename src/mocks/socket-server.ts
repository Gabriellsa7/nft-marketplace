import { toSocketIo } from '@mswjs/socket.io-binding'
import { getSessionByToken } from '@/mocks/db'
import type { Nft, Order, RealtimeEnvelope } from '@/types'
import { ws } from 'msw'

function getSocketUrl() {
  // MSW has built-in Socket.IO awareness: it strips a leading "/socket.io/" from the
  // pathname before matching, so the link pattern must target the bare origin instead.
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/`
}

const socketLink = ws.link(getSocketUrl())

interface TrackedConnection {
  io: ReturnType<typeof toSocketIo>
  userId: string | null
}

const connections = new Set<TrackedConnection>()

export const socketHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    const tracked: TrackedConnection = { io, userId: null }
    connections.add(tracked)

    // The app identifies itself right after connecting (and after every reconnect),
    // scoping order.updated delivery to the owning session.
    io.client.on('identify', (_event, token: string | null) => {
      const session = token ? getSessionByToken(token) : undefined
      tracked.userId = session?.userId ?? null
    })

    connection.client.addEventListener('close', () => {
      connections.delete(tracked)
    })
  }),
]

/** nft.updated is public catalog data — broadcast to every connected client. */
export function broadcastNftUpdated(envelope: RealtimeEnvelope<Nft>) {
  for (const { io } of connections) {
    io.client.emit('nft.updated', envelope)
  }
}

/** order.updated must never reach a session other than the order's owner. */
export function emitOrderUpdated(userId: string, envelope: RealtimeEnvelope<Order>) {
  for (const { io, userId: connectionUserId } of connections) {
    if (connectionUserId === userId) {
      io.client.emit('order.updated', envelope)
    }
  }
}
