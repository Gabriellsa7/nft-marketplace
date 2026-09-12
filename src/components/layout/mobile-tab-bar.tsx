import { Badge } from '@/components/ui/badge'
import { useSessionQuery } from '@/features/auth/hooks'
import { useCartQuery } from '@/features/cart/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { cn } from 'cn'
import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, Home, ShoppingCart, Store, User } from 'lucide-react'

const TAB_CLASS = 'flex flex-col items-center gap-0.5 p-2'

export function MobileTabBar() {
  const location = useRouterState({ select: (s) => s.location })
  const { data: user } = useSessionQuery()
  const { data: cart } = useCartQuery()
  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  const isHome = location.pathname === '/'
  const isFavorites = location.pathname === '/favorites'
  const isCart = location.pathname === '/cart'
  const isAccount = location.pathname === '/profile' || location.pathname === '/login'

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Link
        to="/"
        search={DEFAULT_CATALOG_SEARCH}
        aria-label="Início"
        aria-current={isHome ? 'page' : undefined}
        className={cn(TAB_CLASS, isHome ? 'text-accent' : 'text-muted-foreground')}
      >
        <Home className="size-5" />
      </Link>

      <Link
        to="/favorites"
        aria-label="Favoritos"
        aria-current={isFavorites ? 'page' : undefined}
        className={cn(TAB_CLASS, isFavorites ? 'text-accent' : 'text-muted-foreground')}
      >
        <Heart className="size-5" />
      </Link>

      <Link
        to="/"
        search={DEFAULT_CATALOG_SEARCH}
        aria-label="Mercado"
        className="relative -mt-6 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg ring-4 ring-background"
      >
        <Store className="size-5" />
      </Link>

      <Link
        to="/cart"
        aria-label={`Carrinho${itemCount > 0 ? `, ${itemCount} itens` : ''}`}
        aria-current={isCart ? 'page' : undefined}
        className={cn(TAB_CLASS, 'relative', isCart ? 'text-accent' : 'text-muted-foreground')}
      >
        <ShoppingCart className="size-5" />
        {itemCount > 0 && (
          <Badge className="absolute top-0 right-0 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
            {itemCount}
          </Badge>
        )}
      </Link>

      {user ? (
        <Link
          to="/profile"
          aria-label="Conta"
          aria-current={isAccount ? 'page' : undefined}
          className={cn(TAB_CLASS, isAccount ? 'text-accent' : 'text-muted-foreground')}
        >
          <User className="size-5" />
        </Link>
      ) : (
        <Link
          to="/login"
          search={{ redirect: location.href }}
          aria-label="Entrar"
          aria-current={isAccount ? 'page' : undefined}
          className={cn(TAB_CLASS, isAccount ? 'text-accent' : 'text-muted-foreground')}
        >
          <User className="size-5" />
        </Link>
      )}
    </nav>
  )
}
