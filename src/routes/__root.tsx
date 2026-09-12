import { Header } from '@/components/layout/header'
import { useRealtimeSync } from '@/features/realtime/hooks'
import { UNAUTHORIZED_EVENT } from '@/lib/api-client'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })

  useRealtimeSync()

  useEffect(() => {
    function handleUnauthorized() {
      queryClient.setQueryData(['session'], null)
      for (const key of ['cart', 'favorites', 'orders', 'profile', 'wallets']) {
        queryClient.removeQueries({ queryKey: [key] })
      }

      const isAuthRoute = location.pathname === '/login' || location.pathname === '/register'
      if (!isAuthRoute) {
        navigate({ to: '/login', search: { redirect: location.href } })
      }
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [queryClient, navigate, location.pathname, location.href])

  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <Outlet />
    </div>
  )
}
