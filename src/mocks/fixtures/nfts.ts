import type { Nft, NftCategory } from '@/types'

const CATEGORIES: NftCategory[] = [
  'art',
  'collectibles',
  'music',
  'photography',
  'sports',
  'virtual-worlds',
]

const CREATORS = [
  { id: 'creator-1', name: 'Ava Nakamura', verified: true },
  { id: 'creator-2', name: 'Leo Ferreira', verified: true },
  { id: 'creator-3', name: 'Mika Chen', verified: false },
  { id: 'creator-4', name: 'Sofia Duarte', verified: true },
]

const COLLECTIONS = [
  'Neon Genesis',
  'Chroma Drift',
  'Silent Echoes',
  'Pixel Ruins',
  'Aurora Bound',
  'Ghost Circuit',
]

function seededImage(seed: string, index: number) {
  return `https://picsum.photos/seed/${seed}-${index}/800/800`
}

function buildNft(index: number): Nft {
  const category = CATEGORIES[index % CATEGORIES.length]
  const creator = CREATORS[index % CREATORS.length]
  const collectionName = COLLECTIONS[index % COLLECTIONS.length]
  const basePrice = 0.15 + ((index * 37) % 900) / 100
  const seed = `nft-${index}`

  const editionCount = (index % 3) + 1
  const editions = Array.from({ length: editionCount }, (_, editionIndex) => {
    const price = (basePrice + editionIndex * 0.2).toFixed(4)
    const supply = 10 + ((index + editionIndex) % 6) * 5
    const available = editionIndex === 0 ? Math.max(0, supply - ((index * 3) % (supply + 1))) : supply
    return {
      id: `${seed}-edition-${editionIndex}`,
      name: editionCount === 1 ? 'Edição única' : `Edição ${editionIndex + 1}`,
      priceEth: price,
      available,
      supply,
    }
  })

  return {
    id: seed,
    slug: seed,
    name: `${collectionName} #${index + 1}`,
    description:
      'Peça digital gerada para o cenário de demonstração do marketplace. Os metadados e a imagem são ilustrativos.',
    imageUrl: seededImage(seed, 0),
    galleryUrls: [seededImage(seed, 0), seededImage(seed, 1), seededImage(seed, 2)],
    category,
    creator: {
      id: creator.id,
      name: creator.name,
      avatarUrl: `https://i.pravatar.cc/150?u=${creator.id}`,
      verified: creator.verified,
    },
    collectionName,
    editions,
    floorPriceEth: editions.reduce((min, e) => (Number(e.priceEth) < Number(min) ? e.priceEth : min), editions[0].priceEth),
    favoritesCount: (index * 13) % 500,
    createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
    version: 1,
  }
}

export const NFT_COUNT = 42

export function createNftFixtures(): Nft[] {
  return Array.from({ length: NFT_COUNT }, (_, index) => buildNft(index))
}
