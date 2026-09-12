import { http, HttpResponse } from 'msw'
import { getDb, persistDb } from '@/mocks/db'
import { HandlerError, requireSession } from '@/mocks/respond'
import { simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import type { Nft } from '@/types'

async function guardNetwork(key: string) {
  try {
    await simulateNetwork(key)
  } catch (err) {
    if (err instanceof MockNetworkError) {
      throw new HandlerError(503, 'transient_error', 'Falha de conexão ao sincronizar favoritos.')
    }
    throw err
  }
}

export const favoritesHandlers = [
  http.get('/api/favorites', async ({ request }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`favorites:list:${session.userId}`)
      const db = getDb()
      const ids = db.favorites[session.userId] ?? []
      const items: Nft[] = ids
        .map((id) => db.nfts.find((n) => n.id === id))
        .filter((n): n is Nft => Boolean(n))
      return HttpResponse.json({ items })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.post('/api/favorites/:nftId', async ({ request, params }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`favorites:add:${session.userId}:${params.nftId}`)
      const db = getDb()
      const nft = db.nfts.find((n) => n.id === params.nftId)
      if (!nft) {
        throw new HandlerError(404, 'not_found', 'NFT não encontrado.')
      }
      const current = db.favorites[session.userId] ?? []
      if (!current.includes(nft.id)) {
        db.favorites[session.userId] = [...current, nft.id]
        persistDb()
      }
      return HttpResponse.json({ ok: true }, { status: 201 })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`favorites:remove:${session.userId}:${params.nftId}`)
      const db = getDb()
      const current = db.favorites[session.userId] ?? []
      db.favorites[session.userId] = current.filter((id) => id !== params.nftId)
      persistDb()
      return HttpResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),
]
