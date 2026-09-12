const TOKEN_KEY = 'nft-marketplace-auth-token'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
  }
}

const GUEST_CART_ID_KEY = 'nft-marketplace-guest-cart-id'

export function getOrCreateGuestCartId(): string {
  try {
    const existing = localStorage.getItem(GUEST_CART_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(GUEST_CART_ID_KEY, id)
    return id
  } catch {
    return 'anonymous'
  }
}

export function clearGuestCartId(): void {
  try {
    localStorage.removeItem(GUEST_CART_ID_KEY)
  } catch {
  }
}
