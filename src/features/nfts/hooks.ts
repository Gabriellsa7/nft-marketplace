import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { fetchNft, fetchNfts } from '@/features/nfts/api'
import type { NftListParams } from '@/types'

export function nftsListQueryOptions(params: NftListParams) {
  return queryOptions({
    queryKey: ['nfts', 'list', params],
    queryFn: ({ signal }) => fetchNfts(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function nftDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['nfts', 'detail', id],
    queryFn: ({ signal }) => fetchNft(id, signal),
    retry: (failureCount, error) => {
      if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 404) {
        return false
      }
      return failureCount < 1
    },
  })
}

export function useNftsQuery(params: NftListParams) {
  return useQuery(nftsListQueryOptions(params))
}

export function useNftQuery(id: string) {
  return useQuery(nftDetailQueryOptions(id))
}
