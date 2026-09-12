import { getDb } from '@/mocks/db'
import { bumpAndBroadcastNft } from '@/mocks/realtime-simulation'
import { errorResponse } from '@/mocks/respond'
import { http, HttpResponse } from 'msw'

export const realtimeTestHandlers = [
  http.post('/api/nfts/:id/_simulate-update', async ({ request, params }) => {
    const db = getDb()
    const nft = db.nfts.find((n) => n.id === params.id)
    if (!nft) return errorResponse(404, 'not_found', 'NFT não encontrado.')

    const body = (await request.json()) as {
      editionId?: string
      priceEth?: string
      available?: number
    }

    bumpAndBroadcastNft(nft.id, (n) => {
      const edition = body.editionId ? n.editions.find((e) => e.id === body.editionId) : n.editions[0]
      if (!edition) return
      if (body.priceEth !== undefined) edition.priceEth = body.priceEth
      if (body.available !== undefined) edition.available = body.available
      n.floorPriceEth = n.editions.reduce(
        (min, e) => (Number(e.priceEth) < Number(min) ? e.priceEth : min),
        n.editions[0].priceEth,
      )
    })

    return HttpResponse.json({ ok: true })
  }),
]
