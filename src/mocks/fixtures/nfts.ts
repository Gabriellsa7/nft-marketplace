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
  'Kurio Apes',
  'Chroma Drift',
  'Silent Echoes',
  'Pixel Ruins',
  'Aurora Bound',
  'Ghost Circuit',
]

/** Local artwork exported from the Figma file — cycled across fixtures instead of a remote placeholder service. */
const ARTWORKS = ['/img/nft01.png', '/img/nft02.png', '/img/nft03.png']

function seededImage(index: number) {
  return ARTWORKS[index % ARTWORKS.length]
}

const AVATAR_COLORS = ['#d28a4c', '#b39463', '#e89b55', '#55321f']

/** Local initials avatar (data URI) — avoids a remote avatar service for offline/Lighthouse friendliness. */
function initialsAvatar(name: string, index: number): string {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="${bg}"/><text x="50%" y="50%" font-family="monospace" font-size="56" font-weight="700" fill="#140d0a" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
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
    imageUrl: seededImage(index),
    galleryUrls: [seededImage(index), seededImage(index + 1), seededImage(index + 2)],
    category,
    creator: {
      id: creator.id,
      name: creator.name,
      avatarUrl: initialsAvatar(creator.name, index),
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
