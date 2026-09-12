import { getSessionByToken } from '@/mocks/db'
import { bearerToken } from '@/mocks/respond'

export function resolveCartOwner(request: Request): string {
  const token = bearerToken(request)
  const session = getSessionByToken(token)
  if (session) return `user:${session.userId}`

  const guestId = request.headers.get('x-guest-cart-id')
  return guestId ? `guest:${guestId}` : 'guest:anonymous'
}
