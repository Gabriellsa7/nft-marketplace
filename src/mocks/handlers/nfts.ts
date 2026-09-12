import { http, HttpResponse } from 'msw'
import { getDb } from '@/mocks/db'
import { errorResponse } from '@/mocks/respond'
import { getScenario, simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import type { Nft, NftCategory, NftListParams, NftNetwork, NftSortOption, Paginated } from '@/types'

const CATEGORIES: NftCategory[] = [
  'art',
  'collectibles',
  'music',
  'photography',
  'sports',
  'virtual-worlds',
]

const NETWORKS: NftNetwork[] = ['ethereum', 'polygon', 'solana']

const SORTS: NftSortOption[] = ['relevance', 'price-asc', 'price-desc', 'recent', 'most-favorited']

function parseListParams(url: URL): NftListParams {
  const params: NftListParams = {}

  const search = url.searchParams.get('search')
  if (search && search.trim()) params.search = search.trim()

  const category = url.searchParams.get('category')
  if (category && CATEGORIES.includes(category as NftCategory)) {
    params.category = category as NftCategory
  }

  const network = url.searchParams.get('network')
  if (network && NETWORKS.includes(network as NftNetwork)) {
    params.network = network as NftNetwork
  }

  const collectionName = url.searchParams.get('collectionName')
  if (collectionName && collectionName.trim()) params.collectionName = collectionName.trim()

  const excludeId = url.searchParams.get('excludeId')
  if (excludeId && excludeId.trim()) params.excludeId = excludeId.trim()

  const minPrice = url.searchParams.get('minPrice')
  if (minPrice && !Number.isNaN(Number(minPrice))) params.minPrice = minPrice

  const maxPrice = url.searchParams.get('maxPrice')
  if (maxPrice && !Number.isNaN(Number(maxPrice))) params.maxPrice = maxPrice

  const sort = url.searchParams.get('sort')
  if (sort && SORTS.includes(sort as NftSortOption)) params.sort = sort as NftSortOption

  const page = Number(url.searchParams.get('page'))
  params.page = Number.isInteger(page) && page > 0 ? page : 1

  const pageSize = Number(url.searchParams.get('pageSize'))
  params.pageSize = Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 48 ? pageSize : 12

  return params
}

function matchesSearch(nft: Nft, search: string): boolean {
  const needle = search.toLowerCase()
  return (
    nft.name.toLowerCase().includes(needle) ||
    nft.collectionName.toLowerCase().includes(needle) ||
    nft.creator.name.toLowerCase().includes(needle) ||
    nft.description.toLowerCase().includes(needle)
  )
}

function filterNfts(nfts: Nft[], params: NftListParams): Nft[] {
  return nfts.filter((nft) => {
    if (params.search && !matchesSearch(nft, params.search)) return false
    if (params.category && nft.category !== params.category) return false
    if (params.network && nft.network !== params.network) return false
    if (params.collectionName && nft.collectionName !== params.collectionName) return false
    if (params.excludeId && nft.id === params.excludeId) return false
    if (params.minPrice && Number(nft.floorPriceEth) < Number(params.minPrice)) return false
    if (params.maxPrice && Number(nft.floorPriceEth) > Number(params.maxPrice)) return false
    return true
  })
}

function sortNfts(nfts: Nft[], sort: NftSortOption): Nft[] {
  const sorted = [...nfts]
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => Number(a.floorPriceEth) - Number(b.floorPriceEth))
    case 'price-desc':
      return sorted.sort((a, b) => Number(b.floorPriceEth) - Number(a.floorPriceEth))
    case 'recent':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'most-favorited':
      return sorted.sort((a, b) => b.favoritesCount - a.favoritesCount)
    case 'relevance':
    default:
      return sorted
  }
}

export const nftHandlers = [
  http.get('/api/nfts', async ({ request }) => {
    const url = new URL(request.url)
    const params = parseListParams(url)

    try {
      await simulateNetwork(`nfts:list:${url.search}`)
    } catch (err) {
      if (err instanceof MockNetworkError) {
        return errorResponse(503, 'transient_error', 'Falha de conexão ao carregar o catálogo.')
      }
      throw err
    }

    const db = getDb()
    const source = getScenario() === 'empty' ? [] : db.nfts

    const filtered = filterNfts(source, params)
    const sorted = sortNfts(filtered, params.sort ?? 'relevance')

    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 12
    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const items = sorted.slice(start, start + pageSize)

    const body: Paginated<Nft> = { items, page, pageSize, total, totalPages }
    return HttpResponse.json(body)
  }),

  http.get('/api/nfts/:id', async ({ params }) => {
    try {
      await simulateNetwork(`nfts:detail:${params.id}`)
    } catch (err) {
      if (err instanceof MockNetworkError) {
        return errorResponse(503, 'transient_error', 'Falha de conexão ao carregar o NFT.')
      }
      throw err
    }

    const db = getDb()
    const nft = db.nfts.find((n) => n.id === params.id || n.slug === params.id)
    if (!nft) {
      return errorResponse(404, 'not_found', 'NFT não encontrado.')
    }
    return HttpResponse.json(nft)
  }),
]
