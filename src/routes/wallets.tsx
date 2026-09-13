import { AccountSidebar } from '@/components/layout/account-sidebar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateWalletMutation, useUpdateWalletMutation, useWalletsQuery } from '@/features/wallets/hooks'
import { requireAuthBeforeLoad } from '@/lib/route-guards'
import { ApiError, type UpsertWalletInput, type Wallet, type WalletNetwork, type WalletRole } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

const NETWORK_LABELS: Record<WalletNetwork, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
}

const walletSchema = z.object({
  label: z.string().min(2, 'Informe um nome para a carteira.'),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido. Use o formato 0x seguido de 40 caracteres.'),
  network: z.enum(['ethereum', 'polygon', 'arbitrum']),
  role: z.enum(['primary', 'secondary']),
})

export const Route = createFileRoute('/wallets')({
  beforeLoad: requireAuthBeforeLoad,
  component: WalletsPage,
})

function WalletsPage() {
  const { data: wallets, isPending, isError, refetch } = useWalletsQuery()
  const [dialogWallet, setDialogWallet] = useState<Wallet | 'new' | null>(null)

  return (
    <main className="mx-auto flex w-full max-w-360 flex-col gap-8 px-5 py-8 sm:flex-row sm:px-8">
      <AccountSidebar />
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Carteiras</h1>
          <Dialog open={dialogWallet !== null} onOpenChange={(open) => !open && setDialogWallet(null)}>
            <DialogTrigger render={<Button onClick={() => setDialogWallet('new')} />}>
              Adicionar
            </DialogTrigger>
            {dialogWallet && (
              <WalletDialogContent
                wallet={dialogWallet === 'new' ? null : dialogWallet}
                onDone={() => setDialogWallet(null)}
              />
            )}
          </Dialog>
        </div>

        {isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>Não foi possível carregar suas carteiras.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {wallets && wallets.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            <p>Nenhuma carteira cadastrada.</p>
          </div>
        )}

        {wallets && wallets.length > 0 && (
          <ul className="flex flex-col gap-3">
            {wallets.map((wallet) => (
              <li
                key={wallet.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{wallet.label}</span>
                    <Badge variant={wallet.role === 'primary' ? 'default' : 'outline'}>
                      {wallet.role === 'primary' ? 'Principal' : 'Secundária'}
                    </Badge>
                    <Badge variant="secondary">{NETWORK_LABELS[wallet.network]}</Badge>
                  </div>
                  <span className="truncate font-mono text-xs text-muted-foreground">{wallet.address}</span>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setDialogWallet(wallet)}>
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function WalletDialogContent({ wallet, onDone }: { wallet: Wallet | null; onDone: () => void }) {
  const createMutation = useCreateWalletMutation()
  const updateMutation = useUpdateWalletMutation()
  const isPending = createMutation.isPending || updateMutation.isPending

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpsertWalletInput>({
    resolver: zodResolver(walletSchema),
    defaultValues: wallet
      ? { label: wallet.label, address: wallet.address, network: wallet.network, role: wallet.role }
      : { label: '', address: '', network: 'ethereum', role: 'secondary' },
  })

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.fields) {
      for (const field of err.fields) {
        if (['label', 'address', 'network', 'role'].includes(field.field)) {
          setError(field.field as keyof UpsertWalletInput, { message: field.message })
        }
      }
    }
  }

  const onSubmit = handleSubmit((values) => {
    if (wallet) {
      updateMutation.mutate({ id: wallet.id, input: values }, { onSuccess: onDone, onError: handleError })
    } else {
      createMutation.mutate(values, { onSuccess: onDone, onError: handleError })
    }
  })

  const topLevelError =
    (createMutation.error instanceof ApiError && !createMutation.error.fields?.length && createMutation.error.message) ||
    (updateMutation.error instanceof ApiError && !updateMutation.error.fields?.length && updateMutation.error.message) ||
    null

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{wallet ? 'Editar carteira' : 'Nova carteira'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {topLevelError && (
          <Alert variant="destructive">
            <AlertDescription>{topLevelError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wallet-label">Nome</Label>
          <Input id="wallet-label" aria-invalid={Boolean(errors.label)} {...register('label')} />
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wallet-address">Endereço</Label>
          <Input
            id="wallet-address"
            placeholder="0x..."
            aria-invalid={Boolean(errors.address)}
            {...register('address')}
          />
          {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wallet-network">Rede</Label>
          <Controller
            control={control}
            name="network"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="wallet-network" className="w-full">
                  <SelectValue>{(value: WalletNetwork) => NETWORK_LABELS[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wallet-role">Papel</Label>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="wallet-role" className="w-full">
                  <SelectValue>
                    {(value: WalletRole) => (value === 'primary' ? 'Principal' : 'Secundária')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Principal</SelectItem>
                  <SelectItem value="secondary">Secundária</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
