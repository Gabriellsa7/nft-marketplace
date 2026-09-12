import type { NftCategory, NftNetwork } from '@/types'

export const CATEGORY_OPTIONS: { value: NftCategory; label: string }[] = [
  { value: 'art', label: 'Arte digital' },
  { value: 'photography', label: 'Fotografia' },
  { value: 'music', label: 'Música' },
  { value: 'virtual-worlds', label: 'Arte 3D' },
  { value: 'collectibles', label: 'Colecionáveis' },
  { value: 'sports', label: 'Esportes' },
]

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<NftCategory, string>

export const NETWORK_OPTIONS: { value: NftNetwork; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'solana', label: 'Solana' },
]

export const NETWORK_LABELS = Object.fromEntries(
  NETWORK_OPTIONS.map((o) => [o.value, o.label]),
) as Record<NftNetwork, string>
