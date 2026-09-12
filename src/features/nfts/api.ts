import { apiClient } from '@/lib/api-client'
import type { Nft, NftListParams, Paginated } from '@/types'

export async function fetchNfts(params: NftListParams, signal?: AbortSignal): Promise<Paginated<Nft>> {
  const { data } = await apiClient.get<Paginated<Nft>>('/nfts', { params, signal })
  return data
}

export async function fetchNft(id: string, signal?: AbortSignal): Promise<Nft> {
  const { data } = await apiClient.get<Nft>(`/nfts/${id}`, { signal })
  return data
}
