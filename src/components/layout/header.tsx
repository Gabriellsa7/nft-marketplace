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
import { Link, useRouterState } from '@tanstack/react-router'

export function Header() {
  const { data: user, isPending: isSessionPending } = useSessionQuery()
  const { data: cart } = useCartQuery()
  const logoutMutation = useLogoutMutation()
  const location = useRouterState({ select: (s) => s.location })
  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="text-sm font-semibold text-foreground">
          NFT Marketplace
        </Link>

        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/cart" />}>
            Carrinho{itemCount > 0 ? ` (${itemCount})` : ''}
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
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link to="/login" search={{ redirect: location.href }} />}
              >
                Entrar
              </Button>
              <Button size="sm" nativeButton={false} render={<Link to="/register" />}>
                Cadastrar
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
