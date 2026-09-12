import type { NftCategory, NftSortOption } from '@/types'

export interface CatalogSearch {
  search: string
  category: NftCategory | 'all'
  minPrice: string
  maxPrice: string
  sort: NftSortOption
  page: number
}

/** Default/reset catalog search — reused by every Link back to "/" outside the catalog route itself. */
export const DEFAULT_CATALOG_SEARCH: CatalogSearch = {
  search: '',
  category: 'all',
  minPrice: '',
  maxPrice: '',
  sort: 'relevance',
  page: 1,
}
