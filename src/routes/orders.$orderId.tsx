import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { orderQueryOptions, useOrderQuery } from '@/features/orders/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { requireAuthBeforeLoad } from '@/lib/route-guards'
import type { OrderStatus } from '@/types'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Clock, PackageCheck, XCircle } from 'lucide-react'

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

  const StatusIcon = order.status === 'confirmed' ? PackageCheck : order.status === 'declined' ? XCircle : Clock

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12 sm:px-8">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center gap-3 border-b border-border px-6 py-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border-2 border-accent text-accent">
            <StatusIcon className="size-8" />
          </div>
          <h1 className="text-lg font-bold">
            {order.status === 'confirmed' && 'Seus NFTs agora estão na sua carteira'}
            {order.status === 'pending' && 'Processando seu pedido'}
            {order.status === 'declined' && 'Não foi possível confirmar seu pedido'}
          </h1>
          <Badge
            variant={order.status === 'confirmed' ? 'default' : order.status === 'declined' ? 'destructive' : 'secondary'}
          >
            {STATUS_LABELS[order.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border px-6 py-4 text-xs">
          <div>
            <span className="block text-muted-foreground">ID da transação</span>
            <span className="font-mono">{order.id}</span>
          </div>
          <div>
            <span className="block text-muted-foreground">Total</span>
            <span>{order.totalEth} ETH</span>
          </div>
          <div>
            <span className="block text-muted-foreground">Carteira</span>
            <span className="font-mono">{order.walletAddress.slice(0, 10)}…</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-border px-6 py-4">
          <h2 className="text-sm font-bold">Detalhes da transação</h2>
          {order.items.map((item) => (
            <div key={`${item.nftId}-${item.editionId}`} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.nftName} × {item.quantity}
              </span>
              <span className="font-bold text-accent">
                {(Number(item.unitPriceEth) * item.quantity).toFixed(4)} ETH
              </span>
            </div>
          ))}
          <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2 text-sm">
            {order.couponCode && (
              <div className="flex justify-between text-accent">
                <span>Desconto ({order.couponCode})</span>
                <span>−{order.discountEth} ETH</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de rede</span>
              <span>{order.networkFeeEth} ETH</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{order.totalEth} ETH</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
          {order.status === 'pending' && (
            <p role="status" className="text-sm text-muted-foreground">
              Aguardando confirmação da rede — isso pode levar alguns segundos. Pode deixar esta página
              aberta ou voltar mais tarde: o pedido é retomado automaticamente.
            </p>
          )}
          {order.status === 'declined' && (
            <p role="alert" className="text-sm text-muted-foreground">
              Nenhum valor foi cobrado e os itens continuam disponíveis para nova compra.
            </p>
          )}
          {order.status === 'confirmed' && (
            <p className="text-sm text-muted-foreground">
              Transação confirmada na {order.network}. A propriedade foi transferida para sua carteira
              conectada e registrada na rede.
            </p>
          )}

          {order.status === 'confirmed' && order.transactionRef && (
            <span className="font-mono text-xs text-muted-foreground">{order.transactionRef}</span>
          )}

          <Button nativeButton={false} render={<Link to="/" search={DEFAULT_CATALOG_SEARCH} />}>
            Voltar ao catálogo
          </Button>
        </div>
      </div>
    </main>
  )
}
