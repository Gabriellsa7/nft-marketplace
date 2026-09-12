import { CATEGORY_LABELS } from '@/lib/nft-labels'
import type { Nft } from '@/types'
import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'

interface NftCardProps {
  nft: Nft
  isFavorite: boolean
  onToggleFavorite: (e: React.MouseEvent, nft: Nft) => void
}

export function NftCard({ nft, isFavorite, onToggleFavorite }: NftCardProps) {
  return (
    <Link
      to="/nfts/$nftId"
      params={{ nftId: nft.id }}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative overflow-hidden bg-elevated">
        <img
          src={nft.imageUrl}
          alt={nft.name}
          width={800}
          height={800}
          loading="lazy"
          className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
        />
        <button
          type="button"
          onClick={(e) => onToggleFavorite(e, nft)}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={isFavorite}
          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Heart className="size-4" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="truncate text-sm font-medium">{nft.name}</span>
        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[nft.category]}</span>
        <span className="mt-1 text-sm font-bold text-accent">{nft.floorPriceEth} ETH</span>
      </div>
    </Link>
  )
}
