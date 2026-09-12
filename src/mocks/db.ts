import { createNftFixtures } from '@/mocks/fixtures/nfts'
import { createUserFixtures, type SeedUser } from '@/mocks/fixtures/users'
import type { Cart, Nft, Order, QuoteRequestItem, User, Wallet } from '@/types'

export interface Session {
  token: string
  userId: string
  expiresAt: number
}

export interface StoredQuote {
  quoteVersion: string
  cartOwner: string
  items: QuoteRequestItem[]
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  couponCode: string | null
  expiresAt: string
}

export interface StoredOrder extends Order {
  userId: string
}

export interface MockDb {
  nfts: Nft[]
  users: SeedUser[]
  sessions: Session[]
  favorites: Record<string, string[]>
  carts: Record<string, Cart>
  quotes: Record<string, StoredQuote>
  orders: StoredOrder[]
  idempotency: Record<string, { orderId: string; requestHash: string }>
}

const STORAGE_KEY = 'nft-marketplace-mock-db-v1'

function seedDb(): MockDb {
  return {
    nfts: createNftFixtures(),
    users: createUserFixtures(),
    sessions: [],
    favorites: {
      'user-ana': ['nft-2', 'nft-7'],
      'user-bruno': ['nft-3'],
    },
    carts: {},
    quotes: {},
    orders: [],
    idempotency: {},
  }
}

let db: MockDb = loadOrSeed()

function loadOrSeed(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
  }
  return seedDb()
}

export function persistDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
  }
}

export function resetDb() {
  db = seedDb()
  persistDb()
}

export function getDb(): MockDb {
  return db
}

export function findUserById(userId: string): User | undefined {
  return db.users.find((u) => u.user.id === userId)?.user
}

export function findWalletsByUserId(userId: string): Wallet[] {
  return db.users.find((u) => u.user.id === userId)?.wallets ?? []
}

export function getSessionByToken(token: string | undefined): Session | undefined {
  if (!token) return undefined
  const session = db.sessions.find((s) => s.token === token)
  if (!session) return undefined
  if (session.expiresAt < Date.now()) return undefined
  return session
}

export function bumpNftVersion(nftId: string) {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (nft) nft.version += 1
}
