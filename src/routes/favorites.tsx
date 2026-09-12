import { NftCard } from '@/components/nft-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFavoritesQuery, useToggleFavoriteMutation } from '@/features/favorites/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { requireAuthBeforeLoad } from '@/lib/route-guards'
import type { Nft } from '@/types'
import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/favorites')({
  beforeLoad: requireAuthBeforeLoad,
  component: FavoritesPage,
})

function FavoritesPage() {
  const { data: favorites, isPending } = useFavoritesQuery(true)
  const toggleFavoriteMutation = useToggleFavoriteMutation()

  function handleToggleFavorite(e: React.MouseEvent, nft: Nft) {
    e.preventDefault()
    e.stopPropagation()
    toggleFavoriteMutation.mutate({ nftId: nft.id, isFavorite: true, nft })
  }

  return (
    <main className="mx-auto flex w-full max-w-360 flex-col gap-8 px-5 py-8 sm:px-8">
      <h1 className="text-xl font-bold text-foreground">Favoritos</h1>

      {isPending && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isPending && (!favorites || favorites.length === 0) && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <p>Você ainda não favoritou nenhum NFT.</p>
          <Button size="sm" nativeButton={false} render={<Link to="/" search={DEFAULT_CATALOG_SEARCH} />}>
            Explorar catálogo
          </Button>
        </div>
      )}

      {!isPending && favorites && favorites.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((nft) => (
            <NftCard key={nft.id} nft={nft} isFavorite onToggleFavorite={handleToggleFavorite} />
          ))}
        </div>
      )}
    </main>
  )
}
