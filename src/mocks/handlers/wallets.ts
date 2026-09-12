import { getDb, persistDb } from '@/mocks/db'
import { HandlerError, requireSession } from '@/mocks/respond'
import { simulateNetwork, MockNetworkError } from '@/mocks/scenario'
import type { UpsertWalletInput, Wallet, WalletNetwork } from '@/types'
import { http, HttpResponse } from 'msw'

const NETWORKS: WalletNetwork[] = ['ethereum', 'polygon', 'arbitrum']
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

async function guardNetwork(key: string) {
  try {
    await simulateNetwork(key)
  } catch (err) {
    if (err instanceof MockNetworkError) {
      throw new HandlerError(503, 'transient_error', 'Falha de conexão ao sincronizar carteiras.')
    }
    throw err
  }
}

function validateWalletInput(input: UpsertWalletInput) {
  const fields = []
  if (!input.label || input.label.trim().length < 2) {
    fields.push({ field: 'label', message: 'Informe um nome para a carteira.' })
  }
  if (!input.address || !ADDRESS_RE.test(input.address)) {
    fields.push({ field: 'address', message: 'Endereço inválido. Use o formato 0x seguido de 40 caracteres.' })
  }
  if (!input.network || !NETWORKS.includes(input.network)) {
    fields.push({ field: 'network', message: 'Selecione uma rede válida.' })
  }
  if (input.role !== 'primary' && input.role !== 'secondary') {
    fields.push({ field: 'role', message: 'Selecione o papel da carteira.' })
  }
  if (fields.length > 0) {
    throw new HandlerError(422, 'validation_error', 'Verifique os campos da carteira.', fields)
  }
}

export const walletHandlers = [
  http.get('/api/wallets', async ({ request }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`wallets:list:${session.userId}`)
      const db = getDb()
      const record = db.users.find((u) => u.user.id === session.userId)
      return HttpResponse.json({ items: record?.wallets ?? [] })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.post('/api/wallets', async ({ request }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`wallets:create:${session.userId}`)
      const input = (await request.json()) as UpsertWalletInput
      validateWalletInput(input)

      const db = getDb()
      const record = db.users.find((u) => u.user.id === session.userId)
      if (!record) throw new HandlerError(401, 'unauthenticated', 'Sessão inválida ou expirada.')

      if (record.wallets.some((w) => w.address.toLowerCase() === input.address.toLowerCase())) {
        throw new HandlerError(409, 'conflict', 'Esta carteira já está cadastrada.', [
          { field: 'address', message: 'Endereço já cadastrado.' },
        ])
      }

      if (input.role === 'primary') {
        record.wallets = record.wallets.map((w) => (w.role === 'primary' ? { ...w, role: 'secondary' } : w))
      }

      const wallet: Wallet = {
        id: `wallet-${Math.random().toString(36).slice(2, 10)}`,
        label: input.label.trim(),
        address: input.address,
        network: input.network,
        role: input.role,
        createdAt: new Date().toISOString(),
      }
      record.wallets.push(wallet)
      persistDb()
      return HttpResponse.json(wallet, { status: 201 })
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),

  http.patch('/api/wallets/:id', async ({ request, params }) => {
    try {
      const session = requireSession(request)
      await guardNetwork(`wallets:update:${session.userId}:${params.id}`)
      const input = (await request.json()) as UpsertWalletInput
      validateWalletInput(input)

      const db = getDb()
      const record = db.users.find((u) => u.user.id === session.userId)
      if (!record) throw new HandlerError(401, 'unauthenticated', 'Sessão inválida ou expirada.')

      const wallet = record.wallets.find((w) => w.id === params.id)
      if (!wallet) throw new HandlerError(404, 'not_found', 'Carteira não encontrada.')

      if (
        record.wallets.some(
          (w) => w.id !== wallet.id && w.address.toLowerCase() === input.address.toLowerCase(),
        )
      ) {
        throw new HandlerError(409, 'conflict', 'Esta carteira já está cadastrada.', [
          { field: 'address', message: 'Endereço já cadastrado.' },
        ])
      }

      if (input.role === 'primary') {
        record.wallets = record.wallets.map((w) =>
          w.id !== wallet.id && w.role === 'primary' ? { ...w, role: 'secondary' } : w,
        )
      }

      wallet.label = input.label.trim()
      wallet.address = input.address
      wallet.network = input.network
      wallet.role = input.role
      persistDb()
      return HttpResponse.json(wallet)
    } catch (err) {
      if (err instanceof HandlerError) return err.toResponse()
      throw err
    }
  }),
]
