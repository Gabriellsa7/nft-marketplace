import { fetchSession, login, logout, mergeGuestCart, register } from '@/features/auth/api'
import { clearAuthToken, clearGuestCartId, getOrCreateGuestCartId, setAuthToken } from '@/lib/auth-storage'
import type { AuthCredentials, RegisterInput } from '@/types'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ['session'],
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: false,
  })
}

export function useSessionQuery() {
  return useQuery(sessionQueryOptions())
}

function clearPrivateCaches(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['cart', 'favorites', 'orders', 'profile', 'wallets']) {
    queryClient.removeQueries({ queryKey: [key] })
  }
}

async function afterAuthSuccess(queryClient: ReturnType<typeof useQueryClient>, token: string, user: unknown) {
  setAuthToken(token)
  const guestCartId = getOrCreateGuestCartId()
  try {
    await mergeGuestCart(guestCartId)
  } finally {
    clearGuestCartId()
  }
  clearPrivateCaches(queryClient)
  queryClient.setQueryData(['session'], user)
}

export function useLoginMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: AuthCredentials) => login(credentials),
    onSuccess: async ({ token, user }) => {
      await afterAuthSuccess(queryClient, token, user)
    },
  })
}

export function useRegisterMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
    onSuccess: async ({ token, user }) => {
      await afterAuthSuccess(queryClient, token, user)
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      clearAuthToken()
      clearPrivateCaches(queryClient)
      queryClient.setQueryData(['session'], null)
    },
  })
}
