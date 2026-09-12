import type { NftCategory, NftNetwork, NftSortOption } from '@/types'

export interface CatalogSearch {
  search: string
  category: NftCategory | 'all'
  network: NftNetwork | 'all'
  minPrice: string
  maxPrice: string
  sort: NftSortOption
  page: number
}

export const DEFAULT_CATALOG_SEARCH: CatalogSearch = {
  search: '',
  category: 'all',
  network: 'all',
  minPrice: '',
  maxPrice: '',
  sort: 'relevance',
  page: 1,
}
