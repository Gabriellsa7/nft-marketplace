import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/types'
import type { AuthCredentials, ChangePasswordInput, RegisterInput, UpdateProfileInput, User } from '@/types'

interface AuthResponse {
  user: User
  token: string
}

export async function login(credentials: AuthCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials)
  return data
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', input)
  return data
}

export async function fetchSession(): Promise<User | null> {
  try {
    const { data } = await apiClient.get<{ user: User }>('/auth/session')
    return data.user
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.code === 'unauthenticated')) {
      return null
    }
    throw err
  }
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function mergeGuestCart(guestCartId: string): Promise<void> {
  await apiClient.post('/cart/merge', { guestCartId })
}

export async function fetchProfile(): Promise<User> {
  const { data } = await apiClient.get<User>('/profile')
  return data
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const { data } = await apiClient.patch<User>('/profile', input)
  return data
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await apiClient.post('/profile/password', input)
}
