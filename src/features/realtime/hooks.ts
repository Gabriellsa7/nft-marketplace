import { useSessionQuery } from '@/features/auth/hooks'
import { getAuthToken } from '@/lib/auth-storage'
import { getSocket } from '@/lib/socket'
import type { Nft, Order, RealtimeEnvelope } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

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
        queryClient.invalidateQueries({ queryKey: ['nfts'] })
        queryClient.invalidateQueries({ queryKey: ['cart'] })
        queryClient.invalidateQueries({ queryKey: ['quote'] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }

      function handleNftUpdated(envelope: RealtimeEnvelope<Nft>) {
        const detailKey = ['nfts', 'detail', envelope.resourceId]
        const cached = queryClient.getQueryData<Nft>(detailKey)
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
