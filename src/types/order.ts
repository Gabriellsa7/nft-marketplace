export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface OrderItem {
  nftId: string
  editionId: string
  nftName: string
  nftImageUrl: string
  editionName: string
  quantity: number
  unitPriceEth: string
}

export interface Order {
  id: string
  status: OrderStatus
  items: OrderItem[]
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  couponCode: string | null
  walletAddress: string
  network: string
  transactionRef: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface CreateOrderInput {
  quoteVersion: string
  walletId: string
  network: string
  collectorName: string
  collectorEmail: string
}

export interface RealtimeEnvelope<TResource> {
  resourceId: string
  version: number
  occurredAt: string
  resource: TResource
}
