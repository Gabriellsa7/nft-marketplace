import { apiClient } from '@/lib/api-client'
import type { UpsertWalletInput, Wallet } from '@/types'

export async function fetchWallets(signal?: AbortSignal): Promise<Wallet[]> {
  const { data } = await apiClient.get<{ items: Wallet[] }>('/wallets', { signal })
  return data.items
}

export async function createWallet(input: UpsertWalletInput): Promise<Wallet> {
  const { data } = await apiClient.post<Wallet>('/wallets', input)
  return data
}

export async function updateWallet(id: string, input: UpsertWalletInput): Promise<Wallet> {
  const { data } = await apiClient.patch<Wallet>(`/wallets/${id}`, input)
  return data
}
