import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionQuery } from '@/features/auth/hooks'
import { useAppliedCoupon } from '@/features/cart/coupon'
import { useCartQuery, useRemoveCartItemMutation, useUpdateCartItemMutation } from '@/features/cart/hooks'
import { useQuoteQuery } from '@/features/quote/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { ApiError } from '@/types'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Minus, Plus, Trash2 } from 'lucide-react'
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
      <main className="mx-auto flex w-full max-w-360 flex-col gap-4 px-5 py-8 sm:px-8">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </main>
    )
  }

  if (isError) {
    return (
      <main className="mx-auto flex w-full max-w-360 flex-col items-center gap-3 px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar o carrinho.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </main>
    )
  }

  const items = cart?.items ?? []

  return (
    <main className="mx-auto flex w-full max-w-360 flex-col gap-6 px-5 py-8 sm:px-8">
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" search={DEFAULT_CATALOG_SEARCH} className="hover:text-foreground hover:underline">
          Início
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Carrinho</span>
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <p>Seu carrinho está vazio.</p>
          <Button nativeButton={false} render={<Link to="/" search={DEFAULT_CATALOG_SEARCH} />}>
            Explorar catálogo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-bold">NFTs</th>
                  <th className="pb-3 font-bold">Preço</th>
                  <th className="pb-3 font-bold">Edições</th>
                  <th className="pb-3 text-right font-bold">Total</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const lineTotal = (Number(item.unitPriceEth) * item.quantity).toFixed(4)
                  return (
                    <tr key={item.id} className="border-b border-border align-top">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.nftImageUrl}
                            alt={item.nftName}
                            className="size-14 shrink-0 rounded-lg bg-elevated object-cover"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{item.nftName}</span>
                            <span className="text-xs text-muted-foreground">{item.editionName}</span>
                            {(item.priceChanged || item.availabilityChanged) && (
                              <Alert variant="destructive" className="mt-1 py-1.5">
                                <AlertDescription className="text-xs">
                                  {item.priceChanged && item.availabilityChanged
                                    ? 'Preço e disponibilidade mudaram.'
                                    : item.priceChanged
                                      ? 'O preço mudou.'
                                      : 'A disponibilidade mudou.'}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 whitespace-nowrap">{item.unitPriceEth} ETH</td>
                      <td className="py-4 pr-4">
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
                            <Minus />
                          </Button>
                          <span className="w-6 text-center" aria-live="polite">
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
                            <Plus />
                          </Button>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-right font-bold whitespace-nowrap text-accent">
                        {lineTotal} ETH
                      </td>
                      <td className="py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${item.nftName} do carrinho`}
                          disabled={removeItemMutation.isPending}
                          onClick={() => removeItemMutation.mutate(item.id)}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">Resumo da carteira</h2>
            <div className="flex flex-col gap-2">
              <label htmlFor="coupon" className="text-sm font-medium">
                Código promocional
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
                    placeholder="Digite o código promocional..."
                    aria-describedby={couponError ? 'coupon-error' : undefined}
                  />
                  <Button onClick={handleApplyCoupon} disabled={!couponInput.trim()}>
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

            <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
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
                <p className="text-muted-foreground">Não foi possível calcular o resumo.</p>
              )}
            </div>

            <Button onClick={goToCheckout} disabled={items.length === 0}>
              Ir para pagamento
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/" search={DEFAULT_CATALOG_SEARCH} />}>
              Continuar explorando
            </Button>
          </aside>
        </div>
      )}
    </main>
  )
}
