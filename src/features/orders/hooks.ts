import { createOrder, fetchOrder } from '@/features/orders/api'
import type { CreateOrderInput } from '@/types'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function orderQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['orders', id],
    queryFn: ({ signal }) => fetchOrder(id, signal),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 1500 : false),
  })
}

export function useOrderQuery(id: string) {
  return useQuery(orderQueryOptions(id))
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateOrderInput; idempotencyKey: string }) =>
      createOrder(input, idempotencyKey),
    onSuccess: (order) => {
      queryClient.setQueryData(['orders', order.id], order)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
