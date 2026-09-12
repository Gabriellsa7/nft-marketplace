import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionQuery } from '@/features/auth/hooks'
import { useAppliedCoupon } from '@/features/cart/coupon'
import { useCartQuery } from '@/features/cart/hooks'
import { useCreateOrderMutation } from '@/features/orders/hooks'
import { useQuoteQuery } from '@/features/quote/hooks'
import { useWalletsQuery } from '@/features/wallets/hooks'
import { requireAuthBeforeLoad } from '@/lib/route-guards'
import { ApiError, type Quote, type Wallet } from '@/types'
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

  const [step, setStep] = useState<'form' | 'review'>('form')
  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(undefined)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [staleNotice, setStaleNotice] = useState<string | null>(null)
  const [reviewedQuote, setReviewedQuote] = useState<Quote | null>(null)

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

  function handleConnect() {
    setConnectDialogOpen(true)
    setConnectionState('connecting')
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
  }

  const goToReview = handleSubmit(() => {
    if (!quote.data) return
    setReviewedQuote(quote.data)
    setStaleNotice(null)
    setStep('review')
  })

  async function handleConfirm(collector: CollectorForm) {
    if (!selectedWallet || !reviewedQuote) return
    setStaleNotice(null)

    const fresh = await quote.refetch()
    const freshQuote = fresh.data
    const cartChanged = cart?.items.some((item) => item.priceChanged || item.availabilityChanged)

    if (
      !freshQuote ||
      cartChanged ||
      freshQuote.totalEth !== reviewedQuote.totalEth ||
      freshQuote.subtotalEth !== reviewedQuote.subtotalEth
    ) {
      setReviewedQuote(freshQuote ?? null)
      setStaleNotice('Os valores foram atualizados. Revise o pedido antes de confirmar novamente.')
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
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
        <Button nativeButton={false} render={<Link to="/" />}>
          Explorar catálogo
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">Pagamento</h1>

      {step === 'form' && (
        <form onSubmit={goToReview} noValidate className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Dados do colecionador</h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collectorName">Nome</Label>
              <Input
                id="collectorName"
                aria-invalid={Boolean(errors.collectorName)}
                {...register('collectorName')}
              />
              {errors.collectorName && (
                <p className="text-xs text-destructive">{errors.collectorName.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collectorEmail">E-mail</Label>
              <Input
                id="collectorEmail"
                type="email"
                aria-invalid={Boolean(errors.collectorEmail)}
                {...register('collectorEmail')}
              />
              {errors.collectorEmail && (
                <p className="text-xs text-destructive">{errors.collectorEmail.message}</p>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Carteira e rede</h2>
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
              <>
                <Select
                  value={selectedWalletId}
                  onValueChange={(value) => {
                    setSelectedWalletId(value)
                    setConnectionState('idle')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets?.map((wallet: Wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        {wallet.label} · {wallet.network}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedWallet && (
                  <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-muted-foreground">{selectedWallet.address}</span>
                      <span
                        role="status"
                        className={
                          connectionState === 'connected'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : connectionState === 'rejected'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        }
                      >
                        {connectionState === 'connected'
                          ? 'Conectada'
                          : connectionState === 'rejected'
                            ? 'Conexão recusada'
                            : 'Não conectada'}
                      </span>
                    </div>
                    {connectionState === 'connected' ? (
                      <Button type="button" variant="outline" size="sm" onClick={disconnect}>
                        Desconectar
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={handleConnect}>
                        {connectionState === 'rejected' ? 'Tentar novamente' : 'Conectar carteira'}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {quote.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {quote.error instanceof ApiError ? quote.error.message : 'Não foi possível calcular o pedido.'}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={!selectedWallet || connectionState !== 'connected' || !quote.data || quote.isError}
          >
            Revisar pedido
          </Button>
        </form>
      )}

      {step === 'review' && reviewedQuote && selectedWallet && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Itens</h2>
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
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
              <span>{reviewedQuote.subtotalEth} ETH</span>
            </div>
            {reviewedQuote.coupon && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Desconto ({reviewedQuote.coupon.code})</span>
                <span>−{reviewedQuote.coupon.discountEth} ETH</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa de rede</span>
              <span>{reviewedQuote.networkFeeEth} ETH</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
              <span>Total</span>
              <span>{reviewedQuote.totalEth} ETH</span>
            </div>
          </section>

          <section className="flex flex-col gap-1 rounded-xl border p-4 text-sm">
            <span className="text-muted-foreground">Carteira</span>
            <span>
              {selectedWallet.label} · {selectedWallet.network}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{selectedWallet.address}</span>
          </section>

          {staleNotice && (
            <Alert variant="destructive">
              <AlertTitle>Valores atualizados</AlertTitle>
              <AlertDescription>{staleNotice}</AlertDescription>
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

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('form')} disabled={createOrderMutation.isPending}>
              Voltar
            </Button>
            <Button
              className="flex-1"
              disabled={createOrderMutation.isPending}
              onClick={handleSubmit(handleConfirm)}
            >
              {createOrderMutation.isPending ? 'Enviando…' : 'Confirmar compra'}
            </Button>
          </div>
        </div>
      )}

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
