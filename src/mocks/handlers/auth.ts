import { http, HttpResponse } from 'msw'
import { getDb, getSessionByToken, persistDb } from '@/mocks/db'
import { mockHashPassword } from '@/mocks/hash'
import { bearerToken, errorResponse, HandlerError, requireSession } from '@/mocks/respond'
import { simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import type { AuthCredentials, FieldError, RegisterInput, User } from '@/types'

const SESSION_TTL_MS = 20 * 60 * 1000

function createToken(): string {
  return `tok_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function toPublicUser(user: User): User {
  return user
}

async function guardNetwork(key: string) {
  try {
    await simulateNetwork(key)
  } catch (err) {
    if (err instanceof MockNetworkError) {
      throw new HandlerError(503, 'transient_error', 'Falha de conexão ao autenticar.')
    }
    throw err
  }
}

export const authHandlers = [
  http.post('/api/auth/register', async ({ request }) => {
    try {
      await guardNetwork('auth:register')
      const input = (await request.json()) as RegisterInput
      const db = getDb()

      const fields: FieldError[] = []
      if (!input.name || input.name.trim().length < 2) {
        fields.push({ field: 'name', message: 'Informe seu nome completo.' })
      }
      if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
        fields.push({ field: 'email', message: 'Informe um e-mail válido.' })
      }
      if (!input.password || input.password.length < 6) {
        fields.push({ field: 'password', message: 'A senha deve ter ao menos 6 caracteres.' })
      }
      if (fields.length > 0) {
        return errorResponse(422, 'validation_error', 'Verifique os campos do formulário.', fields)
      }

      if (db.users.some((u) => u.user.email.toLowerCase() === input.email.toLowerCase())) {
        return errorResponse(409, 'conflict', 'Já existe uma conta com este e-mail.', [
          { field: 'email', message: 'E-mail já cadastrado.' },
        ])
      }

      const user: User = {
        id: `user-${Math.random().toString(36).slice(2, 10)}`,
        name: input.name.trim(),
        email: input.email.toLowerCase(),
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      }

      db.users.push({
        user,
        passwordHash: mockHashPassword(input.password),
        wallets: [],
        favoriteNftIds: [],
      })
      db.favorites[user.id] = []

      const token = createToken()
      db.sessions.push({ token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS })
      persistDb()

      return HttpResponse.json({ user: toPublicUser(user), token }, { status: 201 })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.post('/api/auth/login', async ({ request }) => {
    try {
      await guardNetwork('auth:login')
      const input = (await request.json()) as AuthCredentials
      const db = getDb()

      const record = db.users.find((u) => u.user.email.toLowerCase() === input.email?.toLowerCase())
      if (!record || record.passwordHash !== mockHashPassword(input.password ?? '')) {
        return errorResponse(401, 'validation_error', 'E-mail ou senha incorretos.', [
          { field: 'password', message: 'E-mail ou senha incorretos.' },
        ])
      }

      const token = createToken()
      db.sessions.push({ token, userId: record.user.id, expiresAt: Date.now() + SESSION_TTL_MS })
      persistDb()

      return HttpResponse.json({ user: toPublicUser(record.user), token })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.get('/api/auth/session', async ({ request }) => {
    try {
      await guardNetwork('auth:session')
      const token = bearerToken(request)
      const session = getSessionByToken(token)
      if (!session) {
        return errorResponse(401, 'unauthenticated', 'Sessão inválida ou expirada.')
      }
      const db = getDb()
      const record = db.users.find((u) => u.user.id === session.userId)
      if (!record) {
        return errorResponse(401, 'unauthenticated', 'Sessão inválida ou expirada.')
      }
      return HttpResponse.json({ user: toPublicUser(record.user) })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    try {
      await guardNetwork('auth:logout')
      const token = bearerToken(request)
      const db = getDb()
      db.sessions = db.sessions.filter((s) => s.token !== token)
      persistDb()
      return HttpResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  // Test-only utility to deterministically reproduce session expiration scenarios.
  http.post('/api/auth/_expire', async ({ request }) => {
    const session = requireSession(request)
    session.expiresAt = Date.now() - 1000
    persistDb()
    return HttpResponse.json({ ok: true })
  }),
]
