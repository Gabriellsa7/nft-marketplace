export interface CartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  nftName: string
  nftImageUrl: string
  editionName: string
  unitPriceEth: string
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
  discountEth: string
}

export interface Quote {
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  coupon: AppliedCoupon | null
  quoteVersion: string
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
