import { useLogoutMutation } from '@/features/auth/hooks'
import { cn } from 'cn'
import { Link, useRouterState } from '@tanstack/react-router'
import { CreditCard, LogOut, User } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dados do perfil', to: '/profile' as const, icon: User },
  { label: 'Carteiras', to: '/wallets' as const, icon: CreditCard },
]

const INERT_ITEMS = ['Atividade', 'Lista de interesse', 'Ofertas', 'Arquivos baixados', 'Suporte']

export function AccountSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logoutMutation = useLogoutMutation()

  return (
    <nav aria-label="Menu da conta" className="flex w-full flex-col gap-1 sm:w-56 sm:shrink-0">
      <h2 className="px-2 pb-2 text-sm font-bold">Meu perfil</h2>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.to
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'border-accent bg-muted text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
      {INERT_ITEMS.map((label) => (
        <span
          key={label}
          className="flex cursor-default items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground/40"
          aria-disabled="true"
        >
          {label}
        </span>
      ))}
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="mt-2 flex items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-left text-sm font-medium text-foreground hover:text-accent"
      >
        <LogOut className="size-4" />
        Sair
      </button>
    </nav>
  )
}
