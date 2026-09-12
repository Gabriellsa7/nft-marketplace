import { resolveCartOwner } from '@/mocks/cart-owner'
import { getDb, persistDb } from '@/mocks/db'
import { HandlerError } from '@/mocks/respond'
import { simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import type { Cart, CartItem, Nft, NftEdition } from '@/types'
import { http, HttpResponse } from 'msw'

async function guardNetwork(key: string) {
  try {
    await simulateNetwork(key)
  } catch (err) {
    if (err instanceof MockNetworkError) {
      throw new HandlerError(503, 'transient_error', 'Falha de conexão ao sincronizar o carrinho.')
    }
    throw err
  }
}

function findEdition(nft: Nft | undefined, editionId: string): NftEdition | undefined {
  return nft?.editions.find((e) => e.id === editionId)
}

function getCart(cartOwner: string): Cart {
  const db = getDb()
  return db.carts[cartOwner] ?? { items: [], updatedAt: new Date(0).toISOString() }
}

/** Re-syncs each cart item against the live catalog, flagging price/availability drift. */
function refreshCart(cartOwner: string): Cart {
  const db = getDb()
  const cart = getCart(cartOwner)

  const items: CartItem[] = []
  for (const item of cart.items) {
    const nft = db.nfts.find((n) => n.id === item.nftId)
    const edition = findEdition(nft, item.editionId)
    if (!nft || !edition) continue // item's edition no longer exists; drop it silently

    items.push({
      ...item,
      nftName: nft.name,
      nftImageUrl: nft.imageUrl,
      editionName: edition.name,
      priceChanged: edition.priceEth !== item.unitPriceEth,
      availabilityChanged: edition.available !== item.available,
      unitPriceEth: edition.priceEth,
      available: edition.available,
    })
  }

  const refreshed: Cart = { items, updatedAt: cart.updatedAt }
  db.carts[cartOwner] = refreshed
  persistDb()
  return refreshed
}

export const cartHandlers = [
  http.get('/api/cart', async ({ request }) => {
    try {
      const cartOwner = resolveCartOwner(request)
      await guardNetwork(`cart:get:${cartOwner}`)
      return HttpResponse.json(refreshCart(cartOwner))
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.post('/api/cart/items', async ({ request }) => {
    try {
      const cartOwner = resolveCartOwner(request)
      await guardNetwork(`cart:add:${cartOwner}`)
      const body = (await request.json()) as { nftId: string; editionId: string; quantity: number }

      if (!Number.isInteger(body.quantity) || body.quantity < 1) {
        throw new HandlerError(422, 'validation_error', 'Quantidade inválida.', [
          { field: 'quantity', message: 'Informe uma quantidade inteira maior que zero.' },
        ])
      }

      const db = getDb()
      const nft = db.nfts.find((n) => n.id === body.nftId)
      const edition = findEdition(nft, body.editionId)
      if (!nft || !edition) {
        throw new HandlerError(404, 'not_found', 'NFT ou edição não encontrada.')
      }

      const cart = getCart(cartOwner)
      const existing = cart.items.find((i) => i.nftId === body.nftId && i.editionId === body.editionId)
      const nextQuantity = (existing?.quantity ?? 0) + body.quantity

      if (nextQuantity > edition.available) {
        throw new HandlerError(409, 'availability_conflict', 'Quantidade solicitada indisponível para esta edição.')
      }

      const item: CartItem = {
        id: existing?.id ?? `cart-item-${Math.random().toString(36).slice(2, 10)}`,
        nftId: nft.id,
        editionId: edition.id,
        quantity: nextQuantity,
        nftName: nft.name,
        nftImageUrl: nft.imageUrl,
        editionName: edition.name,
        unitPriceEth: edition.priceEth,
        available: edition.available,
        priceChanged: false,
        availabilityChanged: false,
      }

      const items = existing
        ? cart.items.map((i) => (i.id === existing.id ? item : i))
        : [...cart.items, item]

      db.carts[cartOwner] = { items, updatedAt: new Date().toISOString() }
      persistDb()
      return HttpResponse.json(db.carts[cartOwner], { status: 201 })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.patch('/api/cart/items/:itemId', async ({ request, params }) => {
    try {
      const cartOwner = resolveCartOwner(request)
      await guardNetwork(`cart:update:${cartOwner}:${params.itemId}`)
      const body = (await request.json()) as { quantity: number }

      if (!Number.isInteger(body.quantity) || body.quantity < 1) {
        throw new HandlerError(422, 'validation_error', 'Quantidade inválida.', [
          { field: 'quantity', message: 'Informe uma quantidade inteira maior que zero.' },
        ])
      }

      const db = getDb()
      const cart = getCart(cartOwner)
      const item = cart.items.find((i) => i.id === params.itemId)
      if (!item) {
        throw new HandlerError(404, 'not_found', 'Item não encontrado no carrinho.')
      }

      const nft = db.nfts.find((n) => n.id === item.nftId)
      const edition = findEdition(nft, item.editionId)
      if (!nft || !edition) {
        throw new HandlerError(409, 'availability_conflict', 'Esta edição não está mais disponível.')
      }
      if (body.quantity > edition.available) {
        throw new HandlerError(409, 'availability_conflict', 'Quantidade solicitada indisponível para esta edição.')
      }

      const items = cart.items.map((i) =>
        i.id === item.id
          ? {
              ...i,
              quantity: body.quantity,
              unitPriceEth: edition.priceEth,
              available: edition.available,
              priceChanged: false,
              availabilityChanged: false,
            }
          : i,
      )
      db.carts[cartOwner] = { items, updatedAt: new Date().toISOString() }
      persistDb()
      return HttpResponse.json(db.carts[cartOwner])
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.delete('/api/cart/items/:itemId', async ({ request, params }) => {
    try {
      const cartOwner = resolveCartOwner(request)
      await guardNetwork(`cart:remove:${cartOwner}:${params.itemId}`)
      const db = getDb()
      const cart = getCart(cartOwner)
      const items = cart.items.filter((i) => i.id !== params.itemId)
      db.carts[cartOwner] = { items, updatedAt: new Date().toISOString() }
      persistDb()
      return HttpResponse.json(db.carts[cartOwner])
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  // Merges a visitor's cart into the authenticated user's cart right after login.
  http.post('/api/cart/merge', async ({ request }) => {
    try {
      const cartOwner = resolveCartOwner(request)
      if (!cartOwner.startsWith('user:')) {
        throw new HandlerError(401, 'unauthenticated', 'Sessão inválida ou expirada.')
      }
      const body = (await request.json()) as { guestCartId?: string }
      await guardNetwork(`cart:merge:${cartOwner}`)

      const db = getDb()
      const guestOwner = body.guestCartId ? `guest:${body.guestCartId}` : undefined
      const guestCart = guestOwner ? db.carts[guestOwner] : undefined
      const userCart = getCart(cartOwner)

      if (guestCart && guestCart.items.length > 0) {
        const merged = [...userCart.items]
        for (const guestItem of guestCart.items) {
          const existing = merged.find(
            (i) => i.nftId === guestItem.nftId && i.editionId === guestItem.editionId,
          )
          if (existing) {
            existing.quantity = Math.min(existing.quantity + guestItem.quantity, existing.available)
          } else {
            merged.push(guestItem)
          }
        }
        db.carts[cartOwner] = { items: merged, updatedAt: new Date().toISOString() }
        if (guestOwner) delete db.carts[guestOwner]
        persistDb()
      }

      return HttpResponse.json(refreshCart(cartOwner))
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),
]
