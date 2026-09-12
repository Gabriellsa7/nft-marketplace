import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionQuery } from '@/features/auth/hooks'
import { useAppliedCoupon } from '@/features/cart/coupon'
import { useCartQuery, useRemoveCartItemMutation, useUpdateCartItemMutation } from '@/features/cart/hooks'
import { useQuoteQuery } from '@/features/quote/hooks'
import { ApiError } from '@/types'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

function CartPage() {
  const { data: cart, isPending, isError, refetch } = useCartQuery()
  const { data: user } = useSessionQuery()
  const updateItemMutation = useUpdateCartItemMutation()
  const removeItemMutation = useRemoveCartItemMutation()
  const navigate = useNavigate()

  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useAppliedCoupon()

  const quoteItems = (cart?.items ?? []).map((item) => ({
    nftId: item.nftId,
    editionId: item.editionId,
    quantity: item.quantity,
  }))
  const quote = useQuoteQuery(quoteItems, appliedCoupon, Boolean(cart && cart.items.length > 0))

  function handleApplyCoupon() {
    setAppliedCoupon(couponInput.trim() || undefined)
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(undefined)
    setCouponInput('')
  }

  const couponError =
    appliedCoupon && quote.isError
      ? quote.error instanceof ApiError
        ? quote.error.message
        : 'Não foi possível validar o cupom.'
      : null

  function goToCheckout() {
    if (!user) {
      navigate({ to: '/login', search: { redirect: '/checkout' } })
      return
    }
    navigate({ to: '/checkout' })
  }

  if (isPending) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </main>
    )
  }

  if (isError) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar o carrinho.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </main>
    )
  }

  const items = cart?.items ?? []

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">Carrinho</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Seu carrinho está vazio.</p>
          <Button nativeButton={false} render={<Link to="/" />}>
            Explorar catálogo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex gap-4 rounded-xl border p-3 sm:items-center"
              >
                <img
                  src={item.nftImageUrl}
                  alt={item.nftName}
                  className="size-20 shrink-0 rounded-lg object-cover"
                />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-medium">{item.nftName}</span>
                    <span className="text-sm font-semibold">{item.unitPriceEth} ETH</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.editionName}</span>

                  {(item.priceChanged || item.availabilityChanged) && (
                    <Alert variant="destructive" className="mt-1">
                      <AlertDescription>
                        {item.priceChanged && item.availabilityChanged
                          ? 'O preço e a disponibilidade deste item mudaram.'
                          : item.priceChanged
                            ? 'O preço deste item mudou.'
                            : 'A disponibilidade deste item mudou.'}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Diminuir quantidade de ${item.nftName}`}
                        disabled={item.quantity <= 1 || updateItemMutation.isPending}
                        onClick={() =>
                          updateItemMutation.mutate({ itemId: item.id, quantity: item.quantity - 1 })
                        }
                      >
                        −
                      </Button>
                      <span className="w-8 text-center text-sm" aria-live="polite">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Aumentar quantidade de ${item.nftName}`}
                        disabled={item.quantity >= item.available || updateItemMutation.isPending}
                        onClick={() =>
                          updateItemMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })
                        }
                      >
                        +
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removeItemMutation.isPending}
                      onClick={() => removeItemMutation.mutate(item.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="flex h-fit flex-col gap-4 rounded-xl border p-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="coupon" className="text-sm font-medium">
                Cupom
              </label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-lg border border-input px-2.5 py-1.5 text-sm">
                  <span>{appliedCoupon}</span>
                  <Button variant="ghost" size="sm" onClick={handleRemoveCoupon}>
                    Remover
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="coupon"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Código do cupom"
                    aria-describedby={couponError ? 'coupon-error' : undefined}
                  />
                  <Button variant="outline" onClick={handleApplyCoupon} disabled={!couponInput.trim()}>
                    Aplicar
                  </Button>
                </div>
              )}
              {couponError && (
                <p id="coupon-error" className="text-xs text-destructive">
                  {couponError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              {quote.isPending && quote.fetchStatus !== 'idle' ? (
                <>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-5 w-full" />
                </>
              ) : quote.data ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{quote.data.subtotalEth} ETH</span>
                  </div>
                  {quote.data.coupon && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Desconto ({quote.data.coupon.code})</span>
                      <span>−{quote.data.coupon.discountEth} ETH</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de rede</span>
                    <span>{quote.data.networkFeeEth} ETH</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
                    <span>Total</span>
                    <span>{quote.data.totalEth} ETH</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Não foi possível calcular o resumo.</p>
              )}
            </div>

            <Button onClick={goToCheckout} disabled={items.length === 0}>
              Ir para pagamento
            </Button>
          </aside>
        </div>
      )}
    </main>
  )
}
