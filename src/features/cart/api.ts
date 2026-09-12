import { apiClient } from '@/lib/api-client'
import type { Cart } from '@/types'

export async function fetchCart(signal?: AbortSignal): Promise<Cart> {
  const { data } = await apiClient.get<Cart>('/cart', { signal })
  return data
}

export async function addCartItem(input: { nftId: string; editionId: string; quantity: number }): Promise<Cart> {
  const { data } = await apiClient.post<Cart>('/cart/items', input)
  return data
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  const { data } = await apiClient.patch<Cart>(`/cart/items/${itemId}`, { quantity })
  return data
}

export async function removeCartItem(itemId: string): Promise<Cart> {
  const { data } = await apiClient.delete<Cart>(`/cart/items/${itemId}`)
  return data
}
