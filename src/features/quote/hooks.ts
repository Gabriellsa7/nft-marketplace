import { createQuote } from '@/features/quote/api'
import type { QuoteRequestItem } from '@/types'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

export function useQuoteQuery(items: QuoteRequestItem[], couponCode: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['quote', items, couponCode ?? null],
    queryFn: ({ signal }) => createQuote({ items, couponCode }, signal),
    enabled: enabled && items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  })
}
