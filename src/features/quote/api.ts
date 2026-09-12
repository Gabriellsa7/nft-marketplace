import { apiClient } from '@/lib/api-client'
import type { Quote, QuoteRequest } from '@/types'

export async function createQuote(input: QuoteRequest, signal?: AbortSignal): Promise<Quote> {
  const { data } = await apiClient.post<Quote>('/quote', input, { signal })
  return data
}
