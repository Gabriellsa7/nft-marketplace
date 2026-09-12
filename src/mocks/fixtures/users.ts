import { mockHashPassword } from '@/mocks/hash'
import type { User, Wallet } from '@/types'

export interface SeedUser {
  user: User
  passwordHash: string
  wallets: Wallet[]
  favoriteNftIds: string[]
}

/**
 * Fixed credentials for the two demo collectors — documented in README.
 * ana@demo.nft / demo1234 and bruno@demo.nft / demo1234
 */
export function createUserFixtures(): SeedUser[] {
  return [
    {
      user: {
        id: 'user-ana',
        name: 'Ana Souza',
        email: 'ana@demo.nft',
        avatarUrl: null,
        createdAt: '2025-01-10T12:00:00.000Z',
      },
      passwordHash: mockHashPassword('demo1234'),
      wallets: [
        {
          id: 'wallet-ana-1',
          label: 'Carteira principal',
          address: '0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2',
          network: 'ethereum',
          role: 'primary',
          createdAt: '2025-01-10T12:05:00.000Z',
        },
      ],
      favoriteNftIds: ['nft-2', 'nft-7'],
    },
    {
      user: {
        id: 'user-bruno',
        name: 'Bruno Lima',
        email: 'bruno@demo.nft',
        avatarUrl: null,
        createdAt: '2025-02-20T09:30:00.000Z',
      },
      passwordHash: mockHashPassword('demo1234'),
      wallets: [
        {
          id: 'wallet-bruno-1',
          label: 'Principal',
          address: '0xB2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3',
          network: 'polygon',
          role: 'primary',
          createdAt: '2025-02-20T09:35:00.000Z',
        },
        {
          id: 'wallet-bruno-2',
          label: 'Secundária',
          address: '0xC3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4',
          network: 'arbitrum',
          role: 'secondary',
          createdAt: '2025-02-21T09:35:00.000Z',
        },
      ],
      favoriteNftIds: ['nft-3'],
    },
  ]
}

export const VALID_COUPONS: Record<string, string> = {
  WELCOME10: '0.05',
  NFTDROP: '0.1',
}

export const EXPIRED_COUPONS = new Set(['EXPIRED5'])
