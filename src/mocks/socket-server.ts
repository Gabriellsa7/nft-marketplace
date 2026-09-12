import { toSocketIo } from '@mswjs/socket.io-binding'
import { getSessionByToken } from '@/mocks/db'
import type { Nft, Order, RealtimeEnvelope } from '@/types'
import { ws } from 'msw'

function getSocketUrl() {
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

    io.client.on('identify', (_event, token: string | null) => {
      const session = token ? getSessionByToken(token) : undefined
      tracked.userId = session?.userId ?? null
    })

    connection.client.addEventListener('close', () => {
      connections.delete(tracked)
    })
  }),
]

export function broadcastNftUpdated(envelope: RealtimeEnvelope<Nft>) {
  for (const { io } of connections) {
    io.client.emit('nft.updated', envelope)
  }
}

export function emitOrderUpdated(userId: string, envelope: RealtimeEnvelope<Order>) {
  for (const { io, userId: connectionUserId } of connections) {
    if (connectionUserId === userId) {
      io.client.emit('order.updated', envelope)
    }
  }
}
