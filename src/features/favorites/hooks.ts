import { addFavorite, fetchFavorites, removeFavorite } from '@/features/favorites/api'
import type { Nft } from '@/types'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const FAVORITES_QUERY_KEY = ['favorites']

export function favoritesQueryOptions() {
  return queryOptions({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: ({ signal }) => fetchFavorites(signal),
  })
}

export function useFavoritesQuery(enabled: boolean) {
  return useQuery({ ...favoritesQueryOptions(), enabled })
}

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nftId, isFavorite }: { nftId: string; isFavorite: boolean; nft?: Nft }) =>
      isFavorite ? removeFavorite(nftId) : addFavorite(nftId),
    onMutate: async ({ nftId, isFavorite, nft }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_QUERY_KEY })
      const previous = queryClient.getQueryData<Nft[]>(FAVORITES_QUERY_KEY)
      if (previous) {
        queryClient.setQueryData<Nft[]>(
          FAVORITES_QUERY_KEY,
          isFavorite
            ? previous.filter((item) => item.id !== nftId)
            : nft
              ? [...previous, nft]
              : previous,
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(FAVORITES_QUERY_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY }),
  })
}
