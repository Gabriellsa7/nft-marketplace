import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { orderQueryOptions, useOrderQuery } from '@/features/orders/hooks'
import { requireAuthBeforeLoad } from '@/lib/route-guards'
import type { OrderStatus } from '@/types'
import { Link, createFileRoute } from '@tanstack/react-router'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Processando',
  confirmed: 'Confirmado',
  declined: 'Recusado',
}

export const Route = createFileRoute('/orders/$orderId')({
  beforeLoad: requireAuthBeforeLoad,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(orderQueryOptions(params.orderId))
  },
  component: OrderConfirmationPage,
  pendingComponent: () => (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </main>
  ),
})

function OrderConfirmationPage() {
  const { orderId } = Route.useParams()
  const { data: order } = useOrderQuery(orderId)

  if (!order) return null

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Pedido</h1>
        <Badge
          variant={
            order.status === 'confirmed' ? 'default' : order.status === 'declined' ? 'destructive' : 'secondary'
          }
        >
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {order.status === 'pending' && (
        <p role="status" className="text-sm text-muted-foreground">
          Aguardando confirmação da rede. Isso pode levar alguns segundos — você pode deixar esta página
          aberta ou voltar mais tarde, o pedido é retomado automaticamente.
        </p>
      )}

      {order.status === 'declined' && (
        <p role="alert" className="text-sm text-destructive">
          O pedido foi recusado. Nenhum valor foi cobrado e os itens continuam disponíveis para nova compra.
        </p>
      )}

      {order.status === 'confirmed' && (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          Pedido confirmado com sucesso.
        </p>
      )}

      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Itens</h2>
        {order.items.map((item) => (
          <div key={`${item.nftId}-${item.editionId}`} className="flex justify-between text-sm">
            <span>
              {item.nftName} ({item.editionName}) × {item.quantity}
            </span>
            <span>{item.unitPriceEth} ETH</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-1.5 rounded-xl border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{order.subtotalEth} ETH</span>
        </div>
        {order.couponCode && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>Desconto ({order.couponCode})</span>
            <span>−{order.discountEth} ETH</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxa de rede</span>
          <span>{order.networkFeeEth} ETH</span>
        </div>
        <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
          <span>Total</span>
          <span>{order.totalEth} ETH</span>
        </div>
      </section>

      <section className="flex flex-col gap-1 rounded-xl border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pedido</span>
          <span className="font-mono text-xs">{order.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Carteira</span>
          <span className="font-mono text-xs">{order.walletAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rede</span>
          <span>{order.network}</span>
        </div>
        {order.transactionRef && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Transação</span>
            <span className="font-mono text-xs">{order.transactionRef}</span>
          </div>
        )}
      </section>

      <Button nativeButton={false} render={<Link to="/" />}>
        Voltar ao catálogo
      </Button>
    </main>
  )
}
