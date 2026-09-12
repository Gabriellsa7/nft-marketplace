import { apiClient } from '@/lib/api-client'
import type { Nft } from '@/types'

export async function fetchFavorites(signal?: AbortSignal): Promise<Nft[]> {
  const { data } = await apiClient.get<{ items: Nft[] }>('/favorites', { signal })
  return data.items
}

export async function addFavorite(nftId: string): Promise<void> {
  await apiClient.post(`/favorites/${nftId}`)
}

export async function removeFavorite(nftId: string): Promise<void> {
  await apiClient.delete(`/favorites/${nftId}`)
}
