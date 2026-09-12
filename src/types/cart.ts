export interface CartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** Snapshot of catalog data at add-time; refreshed via nft.updated events while cart is open. */
  nftName: string
  nftImageUrl: string
  editionName: string
  /** Decimal string, current unit price known to the cart. */
  unitPriceEth: string
  /** Remaining availability for this edition, kept in sync via realtime events. */
  available: number
  priceChanged: boolean
  availabilityChanged: boolean
}

export interface Cart {
  items: CartItem[]
  updatedAt: string
}

export interface AppliedCoupon {
  code: string
  /** Decimal string, absolute discount in ETH. */
  discountEth: string
}

export interface Quote {
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  coupon: AppliedCoupon | null
  /** Monotonic token; must match on order creation or the API rejects as stale. */
  quoteVersion: string
  /** True when any line item's price/availability differs from what the client cached. */
  stale: boolean
  expiresAt: string
}

export interface QuoteRequestItem {
  nftId: string
  editionId: string
  quantity: number
}

export interface QuoteRequest {
  items: QuoteRequestItem[]
  couponCode?: string
}
