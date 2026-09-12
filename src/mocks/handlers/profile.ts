import { getDb, persistDb } from '@/mocks/db'
import { mockHashPassword } from '@/mocks/hash'
import { HandlerError, requireSession } from '@/mocks/respond'
import { simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import type { ChangePasswordInput, UpdateProfileInput } from '@/types'
import { http, HttpResponse } from 'msw'

async function guardNetwork(key: string) {
  try {
    await simulateNetwork(key)
  } catch (err) {
    if (err instanceof MockNetworkError) {
      throw new HandlerError(503, 'transient_error', 'Falha de conexão ao sincronizar o perfil.')
    }
    throw err
  }
}

export const profileHandlers = [
  http.get('/api/profile', async ({ request }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`profile:get:${session.userId}`)
      const db = getDb()
      const record = db.users.find((u) => u.user.id === session.userId)
      if (!record) throw new HandlerError(401, 'unauthenticated', 'Sessão inválida ou expirada.')
      return HttpResponse.json(record.user)
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.patch('/api/profile', async ({ request }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`profile:update:${session.userId}`)
      const input = (await request.json()) as UpdateProfileInput

      const db = getDb()
      const record = db.users.find((u) => u.user.id === session.userId)
      if (!record) throw new HandlerError(401, 'unauthenticated', 'Sessão inválida ou expirada.')

      if (input.name !== undefined && input.name.trim().length < 2) {
        throw new HandlerError(422, 'validation_error', 'Verifique os campos do formulário.', [
          { field: 'name', message: 'Informe seu nome completo.' },
        ])
      }
      if (input.email !== undefined) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
          throw new HandlerError(422, 'validation_error', 'Verifique os campos do formulário.', [
            { field: 'email', message: 'Informe um e-mail válido.' },
          ])
        }
        const taken = db.users.some(
          (u) => u.user.id !== record.user.id && u.user.email.toLowerCase() === input.email!.toLowerCase(),
        )
        if (taken) {
          throw new HandlerError(409, 'conflict', 'Já existe uma conta com este e-mail.', [
            { field: 'email', message: 'E-mail já cadastrado.' },
          ])
        }
      }

      if (input.name !== undefined) record.user.name = input.name.trim()
      if (input.email !== undefined) record.user.email = input.email.toLowerCase()
      if (input.avatarUrl !== undefined) record.user.avatarUrl = input.avatarUrl
      persistDb()
      return HttpResponse.json(record.user)
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.post('/api/profile/password', async ({ request }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`profile:password:${session.userId}`)
      const input = (await request.json()) as ChangePasswordInput

      const db = getDb()
      const record = db.users.find((u) => u.user.id === session.userId)
      if (!record) throw new HandlerError(401, 'unauthenticated', 'Sessão inválida ou expirada.')

      if (record.passwordHash !== mockHashPassword(input.currentPassword ?? '')) {
        throw new HandlerError(422, 'validation_error', 'Verifique os campos do formulário.', [
          { field: 'currentPassword', message: 'Senha atual incorreta.' },
        ])
      }
      if (!input.newPassword || input.newPassword.length < 6) {
        throw new HandlerError(422, 'validation_error', 'Verifique os campos do formulário.', [
          { field: 'newPassword', message: 'A nova senha deve ter ao menos 6 caracteres.' },
        ])
      }

      record.passwordHash = mockHashPassword(input.newPassword)
      // Changing the password invalidates other sessions for this account.
      db.sessions = db.sessions.filter((s) => s.token === session.token)
      persistDb()
      return HttpResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),
]
