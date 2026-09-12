import { sessionQueryOptions } from '@/features/auth/hooks'
import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'

export async function requireAuthBeforeLoad({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}) {
  const user = await context.queryClient.ensureQueryData(sessionQueryOptions())
  if (!user) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
  return { user }
}
