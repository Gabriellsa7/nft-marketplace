import { getSessionByToken } from '@/mocks/db'
import { bearerToken } from '@/mocks/respond'

/** Resolves the cart partition key: the authenticated user, or a client-supplied guest id. */
export function resolveCartOwner(request: Request): string {
  const token = bearerToken(request)
  const session = getSessionByToken(token)
  if (session) return `user:${session.userId}`

  const guestId = request.headers.get('x-guest-cart-id')
  return guestId ? `guest:${guestId}` : 'guest:anonymous'
}
