import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChangePasswordMutation, useProfileQuery, useUpdateProfileMutation } from '@/features/profile/hooks'
import { requireAuthBeforeLoad } from '@/lib/route-guards'
import { ApiError, type ChangePasswordInput, type UpdateProfileInput } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const profileSchema = z.object({
  name: z.string().min(2, 'Informe seu nome completo.'),
  email: z.string().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  avatarUrl: z.string().url('Informe uma URL válida.').or(z.literal('')),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe sua senha atual.'),
    newPassword: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

export const Route = createFileRoute('/profile')({
  beforeLoad: requireAuthBeforeLoad,
  component: ProfilePage,
})

function ProfilePage() {
  const { data: user, isPending } = useProfileQuery()

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-10 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">Perfil</h1>
      {isPending || !user ? null : (
        <>
          <ProfileForm user={user} />
          <PasswordForm />
        </>
      )}
    </main>
  )
}

function ProfileForm({ user }: { user: { name: string; email: string; avatarUrl: string | null } }) {
  const updateMutation = useUpdateProfileMutation()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? '' },
  })
  const avatarUrl = watch('avatarUrl')

  const onSubmit = handleSubmit((values) => {
    setSuccessMessage(null)
    updateMutation.mutate(
      { ...values, avatarUrl: values.avatarUrl || undefined },
      {
        onSuccess: () => setSuccessMessage('Perfil atualizado.'),
        onError: (err) => {
          if (err instanceof ApiError && err.fields) {
            for (const field of err.fields) {
              if (field.field === 'name' || field.field === 'email' || field.field === 'avatarUrl') {
                setError(field.field, { message: field.message })
              }
            }
          }
        },
      },
    )
  })

  const topLevelError =
    updateMutation.error instanceof ApiError && !updateMutation.error.fields?.length
      ? updateMutation.error.message
      : null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">Dados da conta</h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {topLevelError && (
          <Alert variant="destructive">
            <AlertDescription>{topLevelError}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert>
            <AlertDescription role="status">{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <Avatar className="size-14">
            <AvatarImage src={avatarUrl || undefined} alt="" />
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Label htmlFor="avatarUrl">URL do avatar</Label>
            <Input id="avatarUrl" placeholder="https://…" {...register('avatarUrl')} />
            {errors.avatarUrl && <p className="text-xs text-destructive">{errors.avatarUrl.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" aria-invalid={Boolean(errors.name)} {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" disabled={updateMutation.isPending} className="self-start">
          {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </form>
    </section>
  )
}

function PasswordForm() {
  const changePasswordMutation = useChangePasswordMutation()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput & { confirmPassword: string }>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = handleSubmit(({ confirmPassword, ...input }) => {
    void confirmPassword
    setSuccessMessage(null)
    changePasswordMutation.mutate(input, {
      onSuccess: () => {
        setSuccessMessage('Senha alterada.')
        reset()
      },
      onError: (err) => {
        if (err instanceof ApiError && err.fields) {
          for (const field of err.fields) {
            if (field.field === 'currentPassword' || field.field === 'newPassword') {
              setError(field.field, { message: field.message })
            }
          }
        }
      },
    })
  })

  const topLevelError =
    changePasswordMutation.error instanceof ApiError && !changePasswordMutation.error.fields?.length
      ? changePasswordMutation.error.message
      : null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">Alterar senha</h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {topLevelError && (
          <Alert variant="destructive">
            <AlertDescription>{topLevelError}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert>
            <AlertDescription role="status">{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
          {errors.currentPassword && (
            <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
          {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" disabled={changePasswordMutation.isPending} className="self-start">
          {changePasswordMutation.isPending ? 'Salvando…' : 'Alterar senha'}
        </Button>
      </form>
    </section>
  )
}
