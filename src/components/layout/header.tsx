import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogoutMutation, useSessionQuery } from '@/features/auth/hooks'
import { useCartQuery } from '@/features/cart/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { Link, useRouterState } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart } from 'lucide-react'

const INERT_NAV_ITEMS = ['Criadores', 'Aprenda']

export function Header() {
  const { data: user, isPending: isSessionPending } = useSessionQuery()
  const { data: cart } = useCartQuery()
  const logoutMutation = useLogoutMutation()
  const location = useRouterState({ select: (s) => s.location })
  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-360 items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" search={DEFAULT_CATALOG_SEARCH} className="shrink-0 text-base font-bold tracking-[0.2em] text-foreground">
          KURIO
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          <Link
            to="/"
            search={DEFAULT_CATALOG_SEARCH}
            className="relative py-1 text-foreground/90 transition-colors hover:text-foreground [&.active-nav]:text-accent"
            activeOptions={{ exact: true }}
            activeProps={{
              className:
                'active-nav after:absolute after:-bottom-px after:left-0 after:h-px after:w-full after:bg-accent',
            }}
          >
            Início
          </Link>
          <Link to="/" search={DEFAULT_CATALOG_SEARCH} className="py-1 text-foreground/90 transition-colors hover:text-foreground">
            Mercado
          </Link>
          {INERT_NAV_ITEMS.map((label) => (
            <span key={label} className="cursor-default text-foreground/40" aria-disabled="true">
              {label}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" aria-label="Buscar" className="hidden sm:inline-flex">
            <Search />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Carrinho${itemCount > 0 ? `, ${itemCount} itens` : ''}`}
            nativeButton={false}
            render={<Link to="/cart" className="relative" />}
          >
            <ShoppingCart />
            {itemCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                {itemCount}
              </Badge>
            )}
          </Button>

          {isSessionPending ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm">
                    {user.name.split(' ')[0]}
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link to="/profile" />}>Perfil</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/wallets" />}>Carteiras</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={logoutMutation.isPending}
                  onClick={() => logoutMutation.mutate()}
                >
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link to="/login" search={{ redirect: location.href }} />}
            >
              <LogIn data-icon="inline-start" /> Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
