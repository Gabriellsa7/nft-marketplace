import { createWallet, fetchWallets, updateWallet } from '@/features/wallets/api'
import type { UpsertWalletInput } from '@/types'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const WALLETS_QUERY_KEY = ['wallets']

export function walletsQueryOptions() {
  return queryOptions({
    queryKey: WALLETS_QUERY_KEY,
    queryFn: ({ signal }) => fetchWallets(signal),
  })
}

export function useWalletsQuery() {
  return useQuery(walletsQueryOptions())
}

export function useCreateWalletMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertWalletInput) => createWallet(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLETS_QUERY_KEY }),
  })
}

export function useUpdateWalletMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertWalletInput }) => updateWallet(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLETS_QUERY_KEY }),
  })
}
