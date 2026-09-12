export type NftCategory =
  | 'art'
  | 'collectibles'
  | 'music'
  | 'photography'
  | 'sports'
  | 'virtual-worlds'

export type NftNetwork = 'ethereum' | 'polygon' | 'solana'

export interface NftEdition {
  id: string
  name: string
  priceEth: string
  available: number
  supply: number
}

export interface NftCreator {
  id: string
  name: string
  avatarUrl: string
  verified: boolean
}

export interface NftReview {
  author: string
  avatarUrl: string
  rating: number
  comment: string
}

export interface Nft {
  id: string
  slug: string
  name: string
  description: string
  imageUrl: string
  galleryUrls: string[]
  category: NftCategory
  creator: NftCreator
  collectionName: string
  editions: NftEdition[]
  floorPriceEth: string
  favoritesCount: number
  createdAt: string
  version: number
  network: NftNetwork
  tokenId: string
  attributes: string[]
  contractAddress: string
  royaltyPercent: number
  rating: number
  reviewsCount: number
  reviews: NftReview[]
}

export type NftSortOption =
  | 'relevance'
  | 'price-asc'
  | 'price-desc'
  | 'recent'
  | 'most-favorited'

export interface NftListParams {
  search?: string
  category?: NftCategory
  network?: NftNetwork
  minPrice?: string
  maxPrice?: string
  sort?: NftSortOption
  page?: number
  pageSize?: number
  collectionName?: string
  excludeId?: string
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
