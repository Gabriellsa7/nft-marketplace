import { useSessionQuery } from '@/features/auth/hooks'
import { getAuthToken } from '@/lib/auth-storage'
import { getSocket } from '@/lib/socket'
import type { Nft, Order, RealtimeEnvelope } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

/**
 * Keeps the Socket.IO connection identified with the current session and applies
 * nft.updated/order.updated events to the query cache. Mounted once at the app root.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const { data: user } = useSessionQuery()
  const userId = user?.id ?? null

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    getSocket().then((socket) => {
      if (cancelled) return

      function handleConnect() {
        socket.emit('identify', getAuthToken())
        // Reconcile with REST after every (re)connect — covers dropped-connection recovery.
        queryClient.invalidateQueries({ queryKey: ['nfts'] })
        queryClient.invalidateQueries({ queryKey: ['cart'] })
        queryClient.invalidateQueries({ queryKey: ['quote'] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }

      function handleNftUpdated(envelope: RealtimeEnvelope<Nft>) {
        const detailKey = ['nfts', 'detail', envelope.resourceId]
        const cached = queryClient.getQueryData<Nft>(detailKey)
        // Tolerate duplicate/out-of-order delivery: never regress a newer cached version.
        if (!cached || envelope.version > cached.version) {
          queryClient.setQueryData(detailKey, envelope.resource)
        }
        queryClient.invalidateQueries({ queryKey: ['nfts', 'list'] })
        queryClient.invalidateQueries({ queryKey: ['cart'] })
        queryClient.invalidateQueries({ queryKey: ['quote'] })
      }

      function handleOrderUpdated(envelope: RealtimeEnvelope<Order>) {
        const key = ['orders', envelope.resourceId]
        const cached = queryClient.getQueryData<Order>(key)
        if (!cached || envelope.version > cached.version) {
          queryClient.setQueryData(key, envelope.resource)
        }
      }

      socket.on('connect', handleConnect)
      socket.on('nft.updated', handleNftUpdated)
      socket.on('order.updated', handleOrderUpdated)

      // Reconnecting (rather than relying on an existing connection) re-runs the
      // handshake so `identify` always reflects the *current* userId — this is what
      // stops a previous session's order.updated events from reaching the next user.
      if (socket.connected) socket.disconnect()
      socket.connect()

      cleanup = () => {
        socket.off('connect', handleConnect)
        socket.off('nft.updated', handleNftUpdated)
        socket.off('order.updated', handleOrderUpdated)
        socket.disconnect()
      }
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [queryClient, userId])
}
