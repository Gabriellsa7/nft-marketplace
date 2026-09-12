import { resolveCartOwner } from '@/mocks/cart-owner'
import { EXPIRED_COUPONS, VALID_COUPONS } from '@/mocks/fixtures/users'
import { getDb, persistDb } from '@/mocks/db'
import { HandlerError } from '@/mocks/respond'
import { simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import type { Quote, QuoteRequest, QuoteRequestItem } from '@/types'
import Decimal from 'decimal.js'
import { http, HttpResponse } from 'msw'

const QUOTE_TTL_MS = 2 * 60 * 1000
const NETWORK_FEE_RATE = '0.0025'
const MIN_NETWORK_FEE = '0.0008'

function toEthString(value: Decimal): string {
  return value.toFixed(4)
}

async function guardNetwork(key: string) {
  try {
    await simulateNetwork(key)
  } catch (err) {
    if (err instanceof MockNetworkError) {
      throw new HandlerError(503, 'transient_error', 'Falha de conexão ao calcular a cotação.')
    }
    throw err
  }
}

export const quoteHandlers = [
  http.post('/api/quote', async ({ request }) => {
    try {
      const cartOwner = resolveCartOwner(request)
      await guardNetwork(`quote:create:${cartOwner}`)

      const body = (await request.json()) as QuoteRequest
      if (!body.items || body.items.length === 0) {
        throw new HandlerError(422, 'validation_error', 'O carrinho está vazio.')
      }

      const db = getDb()
      let subtotal = new Decimal(0)
      const items: QuoteRequestItem[] = []

      for (const requested of body.items) {
        const nft = db.nfts.find((n) => n.id === requested.nftId)
        const edition = nft?.editions.find((e) => e.id === requested.editionId)
        if (!nft || !edition) {
          throw new HandlerError(404, 'not_found', 'Um dos itens do carrinho não foi encontrado.')
        }
        if (requested.quantity > edition.available) {
          throw new HandlerError(
            409,
            'availability_conflict',
            `Disponibilidade insuficiente para "${nft.name}".`,
          )
        }
        subtotal = subtotal.plus(new Decimal(edition.priceEth).times(requested.quantity))
        items.push(requested)
      }

      let discount = new Decimal(0)
      let couponCode: string | null = null
      if (body.couponCode) {
        const code = body.couponCode.toUpperCase()
        if (EXPIRED_COUPONS.has(code)) {
          throw new HandlerError(410, 'coupon_expired', 'Este cupom expirou.', [
            { field: 'couponCode', message: 'Cupom expirado.' },
          ])
        }
        const value = VALID_COUPONS[code]
        if (!value) {
          throw new HandlerError(422, 'coupon_invalid', 'Cupom inválido.', [
            { field: 'couponCode', message: 'Cupom não reconhecido.' },
          ])
        }
        discount = Decimal.min(new Decimal(value), subtotal)
        couponCode = code
      }

      const networkFee = Decimal.max(
        new Decimal(MIN_NETWORK_FEE),
        subtotal.minus(discount).times(NETWORK_FEE_RATE),
      )
      const total = Decimal.max(new Decimal(0), subtotal.minus(discount).plus(networkFee))

      const quoteVersion = `qte_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
      const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString()

      db.quotes[quoteVersion] = {
        quoteVersion,
        cartOwner,
        items,
        subtotalEth: toEthString(subtotal),
        discountEth: toEthString(discount),
        networkFeeEth: toEthString(networkFee),
        totalEth: toEthString(total),
        couponCode,
        expiresAt,
      }
      persistDb()

      const quote: Quote = {
        subtotalEth: toEthString(subtotal),
        discountEth: toEthString(discount),
        networkFeeEth: toEthString(networkFee),
        totalEth: toEthString(total),
        coupon: couponCode ? { code: couponCode, discountEth: toEthString(discount) } : null,
        quoteVersion,
        stale: false,
        expiresAt,
      }
      return HttpResponse.json(quote)
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),
]
