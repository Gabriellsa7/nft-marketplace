export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt: string
}

export interface AuthCredentials {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface UpdateProfileInput {
  name?: string
  email?: string
  avatarUrl?: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export type WalletNetwork = 'ethereum' | 'polygon' | 'arbitrum'

export type WalletRole = 'primary' | 'secondary'

export interface Wallet {
  id: string
  label: string
  address: string
  network: WalletNetwork
  role: WalletRole
  createdAt: string
}

export interface UpsertWalletInput {
  label: string
  address: string
  network: WalletNetwork
  role: WalletRole
}
