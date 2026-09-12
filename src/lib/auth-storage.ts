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
    // storage unavailable (private mode, quota) — session won't survive refresh
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

const GUEST_CART_ID_KEY = 'nft-marketplace-guest-cart-id'

/** Stable id for the visitor's cart before they authenticate; merged into the account cart on login. */
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
    // ignore
  }
}
