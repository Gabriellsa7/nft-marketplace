import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLoginMutation } from '@/features/auth/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { ApiError } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

type LoginForm = z.infer<typeof loginSchema>

export const Route = createFileRoute('/login')({
  validateSearch: (raw: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof raw.redirect === 'string' ? raw.redirect : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const loginMutation = useLoginMutation()
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        if (redirect) {
          navigate({ href: redirect })
        } else {
          navigate({ to: '/', search: DEFAULT_CATALOG_SEARCH })
        }
      },
      onError: (err) => {
        if (err instanceof ApiError && err.fields) {
          for (const field of err.fields) {
            if (field.field === 'email' || field.field === 'password') {
              setError(field.field, { message: field.message })
            }
          }
        }
      },
    })
  })

  const topLevelError =
    loginMutation.error instanceof ApiError && !loginMutation.error.fields?.length
      ? loginMutation.error.message
      : null

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16 sm:px-8">
      <div className="overflow-hidden rounded-2xl border-t-2 border-accent bg-card ring-1 ring-border">
        <div className="flex flex-col gap-4 p-6">
          <nav className="flex items-center gap-4 text-sm">
            <span className="border-b-2 border-accent pb-1 font-bold text-foreground">Entrar</span>
            <Link to="/register" className="pb-1 text-muted-foreground hover:text-foreground">
              Criar conta
            </Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            Entre para gerenciar sua carteira, coleção e perfil de criador.
          </p>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {topLevelError && (
              <Alert variant="destructive">
                <AlertDescription>{topLevelError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="contato@email.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...registerField('email')}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...registerField('password')}
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={loginMutation.isPending} className="mt-2">
              {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
