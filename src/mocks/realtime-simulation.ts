import { getDb, persistDb } from '@/mocks/db'
import { broadcastNftUpdated } from '@/mocks/socket-server'
import type { Nft, RealtimeEnvelope } from '@/types'

/** Applies a mutation to an NFT, bumps its version, persists, and broadcasts nft.updated. */
export function bumpAndBroadcastNft(nftId: string, mutate: (nft: Nft) => void): void {
  const db = getDb()
  const nft = db.nfts.find((n) => n.id === nftId)
  if (!nft) return

  mutate(nft)
  nft.version += 1
  persistDb()

  const envelope: RealtimeEnvelope<Nft> = {
    resourceId: nft.id,
    version: nft.version,
    occurredAt: new Date().toISOString(),
    resource: nft,
  }
  broadcastNftUpdated(envelope)
}

function recomputeFloorPrice(nft: Nft): void {
  nft.floorPriceEth = nft.editions.reduce(
    (min, e) => (Number(e.priceEth) < Number(min) ? e.priceEth : min),
    nft.editions[0].priceEth,
  )
}

let ambientTimer: ReturnType<typeof setInterval> | null = null

/** Periodically drifts a random NFT's price/availability, simulating a live marketplace. */
export function startAmbientNftDrift(): void {
  if (ambientTimer) return
  ambientTimer = setInterval(() => {
    const db = getDb()
    if (db.nfts.length === 0) return
    const nft = db.nfts[Math.floor(Math.random() * db.nfts.length)]
    const edition = nft.editions[Math.floor(Math.random() * nft.editions.length)]

    bumpAndBroadcastNft(nft.id, (n) => {
      const drift = (Math.random() - 0.5) * 0.02
      edition.priceEth = Math.max(0.01, Number(edition.priceEth) + drift).toFixed(4)
      if (Math.random() < 0.3 && edition.available > 0) {
        edition.available -= 1
      }
      recomputeFloorPrice(n)
    })
  }, 25_000)
}

export function stopAmbientNftDrift(): void {
  if (ambientTimer) {
    clearInterval(ambientTimer)
    ambientTimer = null
  }
}
