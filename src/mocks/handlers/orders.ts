import { findWalletsByUserId, getDb, persistDb, type StoredOrder } from '@/mocks/db'
import { bumpAndBroadcastNft } from '@/mocks/realtime-simulation'
import { HandlerError, requireSession } from '@/mocks/respond'
import { simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import { emitOrderUpdated } from '@/mocks/socket-server'
import type { CreateOrderInput, Order, OrderItem, RealtimeEnvelope } from '@/types'
import { http, HttpResponse } from 'msw'

const ORDER_RESOLUTION_DELAY_MS = 4000

async function guardNetwork(key: string) {
  try {
    await simulateNetwork(key)
  } catch (err) {
    if (err instanceof MockNetworkError) {
      throw new HandlerError(503, 'transient_error', 'Falha de conexão ao enviar o pedido.')
    }
    throw err
  }
}

function toPublicOrder(stored: StoredOrder): Order {
  return {
    id: stored.id,
    status: stored.status,
    items: stored.items,
    subtotalEth: stored.subtotalEth,
    discountEth: stored.discountEth,
    networkFeeEth: stored.networkFeeEth,
    totalEth: stored.totalEth,
    couponCode: stored.couponCode,
    walletAddress: stored.walletAddress,
    network: stored.network,
    transactionRef: stored.transactionRef,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    version: stored.version,
  }
}

async function hashRequestBody(input: CreateOrderInput): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(input))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Resolves a pending order after a delay, simulating on-chain confirmation, and
 * broadcasts the transition over the mock Socket.IO channel (order.updated) — REST
 * polling on GET /api/orders/:id remains as a fallback for reconnect/refresh recovery. */
function scheduleOrderResolution(orderId: string) {
  setTimeout(() => {
    const db = getDb()
    const order = db.orders.find((o) => o.id === orderId)
    if (!order || order.status !== 'pending') return

    // Deterministic-ish outcome so demos stay mostly successful; declines are rare.
    const declined = Math.random() < 0.08
    order.status = declined ? 'declined' : 'confirmed'
    order.transactionRef = declined ? null : `0xtx_${Math.random().toString(36).slice(2, 12)}`
    order.updatedAt = new Date().toISOString()
    order.version += 1
    persistDb()

    const envelope: RealtimeEnvelope<Order> = {
      resourceId: order.id,
      version: order.version,
      occurredAt: order.updatedAt,
      resource: toPublicOrder(order),
    }
    emitOrderUpdated(order.userId, envelope)
  }, ORDER_RESOLUTION_DELAY_MS)
}

export const orderHandlers = [
  http.post('/api/orders', async ({ request }) => {
    try {
      const session = requireSession(request)
      const idempotencyKey = request.headers.get('idempotency-key')
      if (!idempotencyKey) {
        throw new HandlerError(422, 'validation_error', 'Cabeçalho Idempotency-Key é obrigatório.')
      }

      const input = (await request.json()) as CreateOrderInput
      const requestHash = await hashRequestBody(input)

      const db = getDb()
      const existingAttempt = db.idempotency[idempotencyKey]
      if (existingAttempt) {
        if (existingAttempt.requestHash !== requestHash) {
          throw new HandlerError(
            409,
            'idempotency_conflict',
            'Esta chave de idempotência já foi usada com um pedido diferente.',
          )
        }
        const order = db.orders.find((o) => o.id === existingAttempt.orderId)
        if (order) return HttpResponse.json(toPublicOrder(order))
      }

      await guardNetwork(`orders:create:${session.userId}`)

      const quote = db.quotes[input.quoteVersion]
      if (!quote || quote.cartOwner !== `user:${session.userId}`) {
        throw new HandlerError(409, 'quote_stale', 'Cotação inválida. Atualize o carrinho e tente novamente.')
      }
      if (new Date(quote.expiresAt).getTime() < Date.now()) {
        throw new HandlerError(409, 'quote_stale', 'Cotação expirada. Atualize o carrinho e tente novamente.')
      }

      const wallet = findWalletsByUserId(session.userId).find((w) => w.id === input.walletId)
      if (!wallet) {
        throw new HandlerError(422, 'validation_error', 'Selecione uma carteira válida.', [
          { field: 'walletId', message: 'Carteira não encontrada.' },
        ])
      }

      const orderItems: OrderItem[] = []
      for (const quoteItem of quote.items) {
        const nft = db.nfts.find((n) => n.id === quoteItem.nftId)
        const edition = nft?.editions.find((e) => e.id === quoteItem.editionId)
        if (!nft || !edition) {
          throw new HandlerError(404, 'not_found', 'Um dos itens da cotação não foi encontrado.')
        }
        if (edition.available < quoteItem.quantity) {
          throw new HandlerError(409, 'availability_conflict', `Disponibilidade insuficiente para "${nft.name}".`)
        }
        orderItems.push({
          nftId: nft.id,
          editionId: edition.id,
          nftName: nft.name,
          nftImageUrl: nft.imageUrl,
          editionName: edition.name,
          quantity: quoteItem.quantity,
          unitPriceEth: edition.priceEth,
        })
      }

      // Reserve stock and broadcast nft.updated so catalog/detail/cart observers see the drop.
      const purchasedByNft = new Map<string, typeof quote.items>()
      for (const quoteItem of quote.items) {
        const list = purchasedByNft.get(quoteItem.nftId) ?? []
        list.push(quoteItem)
        purchasedByNft.set(quoteItem.nftId, list)
      }
      for (const [nftId, purchases] of purchasedByNft) {
        bumpAndBroadcastNft(nftId, (nft) => {
          for (const purchase of purchases) {
            const edition = nft.editions.find((e) => e.id === purchase.editionId)
            if (edition) edition.available -= purchase.quantity
          }
        })
      }

      // Remove only the purchased items/quantities from the user's cart.
      const cart = db.carts[`user:${session.userId}`]
      if (cart) {
        cart.items = cart.items
          .map((item) => {
            const purchased = quote.items.find(
              (q) => q.nftId === item.nftId && q.editionId === item.editionId,
            )
            if (!purchased) return item
            const remaining = item.quantity - purchased.quantity
            return remaining > 0 ? { ...item, quantity: remaining } : null
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
        cart.updatedAt = new Date().toISOString()
      }

      const now = new Date().toISOString()
      const order: StoredOrder = {
        id: `order-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
        userId: session.userId,
        status: 'pending',
        items: orderItems,
        subtotalEth: quote.subtotalEth,
        discountEth: quote.discountEth,
        networkFeeEth: quote.networkFeeEth,
        totalEth: quote.totalEth,
        couponCode: quote.couponCode,
        walletAddress: wallet.address,
        network: input.network,
        transactionRef: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }

      db.orders.push(order)
      db.idempotency[idempotencyKey] = { orderId: order.id, requestHash }
      persistDb()

      scheduleOrderResolution(order.id)

      return HttpResponse.json(toPublicOrder(order), { status: 201 })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`orders:get:${session.userId}:${params.id}`)

      const db = getDb()
      const order = db.orders.find((o) => o.id === params.id)
      if (!order || order.userId !== session.userId) {
        throw new HandlerError(404, 'not_found', 'Pedido não encontrado.')
      }
      return HttpResponse.json(toPublicOrder(order))
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),
]
