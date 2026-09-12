import { HttpResponse } from 'msw'
import { getSessionByToken, type Session } from '@/mocks/db'
import type { ApiErrorBody, ApiErrorCode, FieldError } from '@/types'

export function errorResponse(status: number, code: ApiErrorCode, message: string, fields?: FieldError[]) {
  const body: ApiErrorBody = { code, message, fields }
  return HttpResponse.json(body, { status })
}

export class HandlerError extends Error {
  status: number
  code: ApiErrorCode
  fields?: FieldError[]

  constructor(status: number, code: ApiErrorCode, message: string, fields?: FieldError[]) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }

  toResponse() {
    return errorResponse(this.status, this.code, this.message, this.fields)
  }
}

export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length)
}

export function requireSession(request: Request): Session {
  const token = bearerToken(request)
  const session = getSessionByToken(token)
  if (!session) {
    throw new HandlerError(401, 'unauthenticated', 'Sessão inválida ou expirada.')
  }
  return session
}
