import { apiClient } from '@/lib/api-client'
import type { CreateOrderInput, Order } from '@/types'

export async function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<Order> {
  const { data } = await apiClient.post<Order>('/orders', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return data
}

export async function fetchOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/orders/${id}`, { signal })
  return data
}
