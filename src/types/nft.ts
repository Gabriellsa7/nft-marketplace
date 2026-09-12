export type NftCategory =
  | 'art'
  | 'collectibles'
  | 'music'
  | 'photography'
  | 'sports'
  | 'virtual-worlds'

export interface NftEdition {
  id: string
  name: string
  /** Decimal string in ETH, e.g. "1.2500" — never a float. */
  priceEth: string
  /** Remaining supply for this edition. */
  available: number
  /** Total minted supply for this edition. */
  supply: number
}

export interface NftCreator {
  id: string
  name: string
  avatarUrl: string
  verified: boolean
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
  /** Lowest priceEth across editions, decimal string, for catalog sorting/display. */
  floorPriceEth: string
  favoritesCount: number
  createdAt: string
  /** Monotonic version bumped by nft.updated events; used to discard stale realtime events. */
  version: number
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
  minPrice?: string
  maxPrice?: string
  sort?: NftSortOption
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
