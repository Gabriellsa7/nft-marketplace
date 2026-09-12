import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionQuery } from '@/features/auth/hooks'
import { useAppliedCoupon } from '@/features/cart/coupon'
import { useCartQuery } from '@/features/cart/hooks'
import { useCreateOrderMutation } from '@/features/orders/hooks'
import { useQuoteQuery } from '@/features/quote/hooks'
import { useWalletsQuery } from '@/features/wallets/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { requireAuthBeforeLoad } from '@/lib/route-guards'
import { ApiError } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const IDEMPOTENCY_KEY_STORAGE = 'nft-marketplace-checkout-idempotency-key'

function getOrCreateIdempotencyKey(): string {
  try {
    const existing = sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE)
    if (existing) return existing
    const key = crypto.randomUUID()
    sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, key)
    return key
  } catch {
    return crypto.randomUUID()
  }
}

function clearIdempotencyKey() {
  try {
    sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE)
  } catch {
    // ignore
  }
}

const collectorSchema = z.object({
  collectorName: z.string().min(2, 'Informe seu nome completo.'),
  collectorEmail: z.string().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
})

type CollectorForm = z.infer<typeof collectorSchema>
type ConnectionState = 'idle' | 'connecting' | 'connected' | 'rejected'

export const Route = createFileRoute('/checkout')({
  beforeLoad: requireAuthBeforeLoad,
  component: CheckoutPage,
})

function CheckoutPage() {
  const navigate = useNavigate()
  const { data: sessionUser } = useSessionQuery()
  const { data: cart, isPending: isCartPending } = useCartQuery()
  const { data: wallets, isPending: isWalletsPending } = useWalletsQuery()
  const [appliedCoupon] = useAppliedCoupon()
  const createOrderMutation = useCreateOrderMutation()

  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(undefined)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [staleNotice, setStaleNotice] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CollectorForm>({
    resolver: zodResolver(collectorSchema),
    defaultValues: { collectorName: sessionUser?.name ?? '', collectorEmail: sessionUser?.email ?? '' },
  })

  const quoteItems = (cart?.items ?? []).map((item) => ({
    nftId: item.nftId,
    editionId: item.editionId,
    quantity: item.quantity,
  }))
  const quote = useQuoteQuery(quoteItems, appliedCoupon, Boolean(cart && cart.items.length > 0))
  const selectedWallet = wallets?.find((w) => w.id === selectedWalletId)

  function handleSelectWallet(walletId: string) {
    setSelectedWalletId(walletId)
    setConnectionState('connecting')
    setConnectDialogOpen(true)
  }

  function approveConnection() {
    setConnectionState('connected')
    setConnectDialogOpen(false)
  }

  function rejectConnection() {
    setConnectionState('rejected')
    setConnectDialogOpen(false)
  }

  function disconnect() {
    setConnectionState('idle')
    setSelectedWalletId(undefined)
  }

  async function handleConfirm(collector: CollectorForm) {
    if (!selectedWallet || !quote.data) return
    setStaleNotice(null)

    const reviewed = quote.data
    const fresh = await quote.refetch()
    const freshQuote = fresh.data
    const cartChanged = cart?.items.some((item) => item.priceChanged || item.availabilityChanged)

    if (
      !freshQuote ||
      cartChanged ||
      freshQuote.totalEth !== reviewed.totalEth ||
      freshQuote.subtotalEth !== reviewed.subtotalEth
    ) {
      setStaleNotice('Os valores foram atualizados. Revise o pedido e confirme novamente.')
      return
    }

    createOrderMutation.mutate(
      {
        input: {
          quoteVersion: freshQuote.quoteVersion,
          walletId: selectedWallet.id,
          network: selectedWallet.network,
          collectorName: collector.collectorName,
          collectorEmail: collector.collectorEmail,
        },
        idempotencyKey: getOrCreateIdempotencyKey(),
      },
      {
        onSuccess: (order) => {
          clearIdempotencyKey()
          navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
        },
      },
    )
  }

  if (isCartPending || isWalletsPending) {
    return (
      <main className="mx-auto flex w-full max-w-360 flex-col gap-4 px-5 py-8 sm:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-360 flex-col items-center gap-3 px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
        <Button nativeButton={false} render={<Link to="/" search={DEFAULT_CATALOG_SEARCH} />}>
          Explorar catálogo
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-360 flex-col gap-6 px-5 py-8 sm:px-8">
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" search={DEFAULT_CATALOG_SEARCH} className="hover:text-foreground hover:underline">
          Início
        </Link>
        <span className="mx-1.5">/</span>
        <Link to="/cart" className="hover:text-foreground hover:underline">
          Carrinho
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Pagamento</span>
      </nav>

      <form
        onSubmit={handleSubmit(handleConfirm)}
        noValidate
        className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_400px]"
      >
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold">Perfil do colecionador</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collectorName">
                Nome de exibição<span className="text-accent">*</span>
              </Label>
              <Input id="collectorName" aria-invalid={Boolean(errors.collectorName)} {...register('collectorName')} />
              {errors.collectorName && <p className="text-xs text-destructive">{errors.collectorName.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collectorEmail">
                E-mail<span className="text-accent">*</span>
              </Label>
              <Input
                id="collectorEmail"
                type="email"
                aria-invalid={Boolean(errors.collectorEmail)}
                {...register('collectorEmail')}
              />
              {errors.collectorEmail && <p className="text-xs text-destructive">{errors.collectorEmail.message}</p>}
            </div>
          </div>

          {quote.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {quote.error instanceof ApiError ? quote.error.message : 'Não foi possível calcular o pedido.'}
              </AlertDescription>
            </Alert>
          )}

          {createOrderMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {createOrderMutation.error instanceof ApiError
                  ? createOrderMutation.error.message
                  : 'Não foi possível enviar o pedido.'}
              </AlertDescription>
            </Alert>
          )}

          {staleNotice && (
            <Alert variant="destructive">
              <AlertTitle>Valores atualizados</AlertTitle>
              <AlertDescription>{staleNotice}</AlertDescription>
            </Alert>
          )}
        </section>

        <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Seus NFTs</h2>
          <ul className="flex flex-col gap-3">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <img src={item.nftImageUrl} alt="" className="size-12 shrink-0 rounded-lg bg-elevated object-cover" />
                <div className="flex flex-1 flex-col">
                  <span className="font-medium">{item.nftName}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.editionName} · x{item.quantity}
                  </span>
                </div>
                <span className="font-bold text-accent">
                  {(Number(item.unitPriceEth) * item.quantity).toFixed(4)} ETH
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
            {quote.data ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{quote.data.subtotalEth} ETH</span>
                </div>
                {quote.data.coupon && (
                  <div className="flex justify-between text-accent">
                    <span>Desconto ({quote.data.coupon.code})</span>
                    <span>−{quote.data.coupon.discountEth} ETH</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa de rede</span>
                  <span>{quote.data.networkFeeEth} ETH</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold">
                  <span>Total</span>
                  <span className="text-accent">{quote.data.totalEth} ETH</span>
                </div>
              </>
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <h3 className="text-sm font-bold">Carteira e rede</h3>
            {wallets && wallets.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Você ainda não tem carteiras cadastradas.{' '}
                  <Link to="/wallets" className="underline underline-offset-4">
                    Cadastrar carteira
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Selecione uma carteira</legend>
                {wallets?.map((wallet) => {
                  const isSelected = wallet.id === selectedWalletId
                  return (
                    <label
                      key={wallet.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-accent"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="wallet"
                          value={wallet.id}
                          checked={isSelected}
                          onChange={() => handleSelectWallet(wallet.id)}
                          className="accent-accent"
                        />
                        {wallet.label} · {wallet.network}
                      </span>
                      {isSelected && (
                        <span
                          role="status"
                          className={
                            connectionState === 'connected'
                              ? 'text-xs text-accent'
                              : connectionState === 'rejected'
                                ? 'text-xs text-destructive'
                                : 'text-xs text-muted-foreground'
                          }
                        >
                          {connectionState === 'connected'
                            ? 'Conectada'
                            : connectionState === 'rejected'
                              ? 'Recusada'
                              : 'Conectando…'}
                        </span>
                      )}
                    </label>
                  )
                })}
                {selectedWallet && connectionState === 'connected' && (
                  <Button type="button" variant="ghost" size="sm" onClick={disconnect} className="self-start">
                    Desconectar
                  </Button>
                )}
                {selectedWallet && connectionState === 'rejected' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectWallet(selectedWallet.id)}
                    className="self-start"
                  >
                    Tentar novamente
                  </Button>
                )}
              </fieldset>
            )}
          </div>

          <Button
            type="submit"
            disabled={
              !selectedWallet || connectionState !== 'connected' || !quote.data || quote.isError || createOrderMutation.isPending
            }
          >
            {createOrderMutation.isPending ? 'Enviando…' : 'Confirmar compra'}
          </Button>
        </aside>
      </form>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar carteira</DialogTitle>
            <DialogDescription>
              Simulação de solicitação de conexão para {selectedWallet?.label} ({selectedWallet?.network}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={rejectConnection}>
              Recusar
            </Button>
            <Button onClick={approveConnection}>Aprovar conexão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
