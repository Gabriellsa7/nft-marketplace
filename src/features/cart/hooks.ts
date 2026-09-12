import { addCartItem, fetchCart, removeCartItem, updateCartItem } from '@/features/cart/api'
import type { Cart } from '@/types'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const CART_QUERY_KEY = ['cart']

export function cartQueryOptions() {
  return queryOptions({
    queryKey: CART_QUERY_KEY,
    queryFn: ({ signal }) => fetchCart(signal),
    staleTime: 10_000,
  })
}

export function useCartQuery() {
  return useQuery(cartQueryOptions())
}

export function useAddCartItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addCartItem,
    onSuccess: (cart) => queryClient.setQueryData(CART_QUERY_KEY, cart),
  })
}

export function useUpdateCartItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = queryClient.getQueryData<Cart>(CART_QUERY_KEY)
      if (previous) {
        queryClient.setQueryData<Cart>(CART_QUERY_KEY, {
          ...previous,
          items: previous.items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_QUERY_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  })
}

export function useRemoveCartItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY })
      const previous = queryClient.getQueryData<Cart>(CART_QUERY_KEY)
      if (previous) {
        queryClient.setQueryData<Cart>(CART_QUERY_KEY, {
          ...previous,
          items: previous.items.filter((item) => item.id !== itemId),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_QUERY_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  })
}
