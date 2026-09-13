import { NftCard } from '@/components/nft-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSessionQuery } from '@/features/auth/hooks'
import { useAddCartItemMutation } from '@/features/cart/hooks'
import { useFavoritesQuery, useToggleFavoriteMutation } from '@/features/favorites/hooks'
import { nftDetailQueryOptions, useNftsQuery } from '@/features/nfts/hooks'
import { DEFAULT_CATALOG_SEARCH } from '@/lib/catalog-search'
import { NETWORK_LABELS } from '@/lib/nft-labels'
import { ApiError, type Nft, type NftEdition } from '@/types'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, Link2, Minus, Plus, Share2, Star } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/nfts/$nftId')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(nftDetailQueryOptions(params.nftId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  component: NftDetailPage,
  pendingComponent: NftDetailSkeleton,
  notFoundComponent: () => (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">NFT não encontrado</h1>
      <p className="text-sm text-muted-foreground">
        Este item pode ter sido removido ou o link está incorreto.
      </p>
      <Button nativeButton={false} render={<Link to="/" search={DEFAULT_CATALOG_SEARCH} />}>
        Voltar ao catálogo
      </Button>
    </main>
  ),
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar este NFT</h1>
      <p className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : 'Erro inesperado.'}
      </p>
      <Button variant="outline" onClick={() => reset()}>
        Tentar novamente
      </Button>
    </main>
  ),
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const { data: nft } = useSuspenseQuery(nftDetailQueryOptions(nftId))
  const [activeImage, setActiveImage] = useState(nft.imageUrl)
  const [quantity, setQuantity] = useState(1)
  const [selectedEditionId, setSelectedEditionId] = useState(nft.editions[0]?.id)
  const selectedEdition = nft.editions.find((e) => e.id === selectedEditionId) ?? nft.editions[0]
  const [addFeedback, setAddFeedback] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const { data: user } = useSessionQuery()
  const { data: favorites } = useFavoritesQuery(Boolean(user))
  const favoriteIds = new Set(favorites?.map((f) => f.id))
  const isFavorite = favoriteIds.has(nft.id)
  const toggleFavoriteMutation = useToggleFavoriteMutation()
  const addCartMutation = useAddCartItemMutation()

  const { data: related } = useNftsQuery({
    collectionName: nft.collectionName,
    excludeId: nft.id,
    pageSize: 5,
  })

  function handleCardToggleFavorite(e: React.MouseEvent, cardNft: Nft) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      navigate({ to: '/login', search: { redirect: location.href } })
      return
    }
    toggleFavoriteMutation.mutate({ nftId: cardNft.id, isFavorite: favoriteIds.has(cardNft.id), nft: cardNft })
  }

  async function handleShare() {
    const shareUrl = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: nft.name, url: shareUrl })
      } catch {
        // usuário cancelou o compartilhamento nativo, nada a fazer
      }
      return
    }
    await handleCopyLink()
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareFeedback('Link copiado para a área de transferência.')
    } catch {
      setShareFeedback('Não foi possível copiar o link.')
    }
  }

  function handleAddToCart() {
    if (!selectedEdition) return
    setAddFeedback(null)
    addCartMutation.mutate(
      { nftId: nft.id, editionId: selectedEdition.id, quantity },
      {
        onSuccess: () => setAddFeedback('Item adicionado ao carrinho.'),
        onError: (err) =>
          setAddFeedback(err instanceof ApiError ? err.message : 'Não foi possível adicionar ao carrinho.'),
      },
    )
  }

  function handleToggleFavorite() {
    if (!user) {
      navigate({ to: '/login', search: { redirect: location.href } })
      return
    }
    toggleFavoriteMutation.mutate({ nftId: nft.id, isFavorite, nft })
  }

  return (
    <main className="mx-auto flex w-full max-w-360 flex-col gap-8 px-5 py-8 sm:px-8">
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" search={DEFAULT_CATALOG_SEARCH} className="hover:text-foreground hover:underline">
          Início
        </Link>
        <span className="mx-1.5">/</span>
        <Link to="/" search={DEFAULT_CATALOG_SEARCH} className="hover:text-foreground hover:underline">
          Mercado
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{nft.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[96px_1fr_420px]">
        <div className="order-2 flex gap-2 lg:order-1 lg:flex-col">
          {nft.galleryUrls.map((url: string) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveImage(url)}
              aria-label="Ver imagem da galeria"
              aria-current={url === activeImage}
              className="size-16 shrink-0 overflow-hidden rounded-lg bg-elevated ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-current:ring-2 aria-current:ring-accent lg:size-24"
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>

        <div className="order-1 overflow-hidden rounded-xl bg-elevated ring-1 ring-border lg:order-2">
          <img src={activeImage} alt={nft.name} width={800} height={800} className="aspect-square w-full object-cover" />
        </div>

        <div className="order-3 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <img src={nft.creator.avatarUrl} alt="" className="size-8 rounded-full" />
            <span className="text-sm font-medium">{nft.creator.name}</span>
            {nft.creator.verified && <Badge>Verificado</Badge>}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">{nft.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">{nft.collectionName}</p>
              <div className="flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className="size-3.5"
                    fill={i < Math.round(nft.rating) ? 'currentColor' : 'none'}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {nft.reviewsCount} avaliações de colecionadores
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold">Sobre este NFT:</span>
            <p className="text-sm leading-relaxed text-muted-foreground">{nft.description}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">Edição</span>
            <div className="flex flex-wrap gap-2">
              {nft.editions.map((edition: NftEdition) => (
                <button
                  key={edition.id}
                  type="button"
                  onClick={() => setSelectedEditionId(edition.id)}
                  aria-pressed={edition.id === selectedEditionId}
                  disabled={edition.available === 0}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {edition.name} · {edition.priceEth} ETH
                  {edition.available === 0 && ' · Esgotado'}
                </button>
              ))}
            </div>
          </div>

          {selectedEdition && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Preço</span>
                <span className="text-xl font-bold text-accent">{selectedEdition.priceEth} ETH</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Disponível</span>
                <span className="text-sm">
                  {selectedEdition.available} de {selectedEdition.supply}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="quantity" className="text-sm text-muted-foreground">
                  Quantidade
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Diminuir quantidade"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus />
                  </Button>
                  <input
                    id="quantity"
                    type="number"
                    min={1}
                    max={Math.max(1, selectedEdition.available)}
                    value={quantity}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      if (Number.isInteger(value)) {
                        setQuantity(Math.min(Math.max(1, value), Math.max(1, selectedEdition.available)))
                      }
                    }}
                    className="h-8 w-14 rounded-lg border border-input bg-transparent text-center text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Aumentar quantidade"
                    onClick={() => setQuantity((q) => Math.min(selectedEdition.available, q + 1))}
                    disabled={quantity >= selectedEdition.available}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={selectedEdition.available === 0 || addCartMutation.isPending}
                  onClick={handleAddToCart}
                >
                  {addCartMutation.isPending ? 'Adicionando…' : 'COMPRAR'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  data-testid="nft-favorite-button"
                  aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  aria-pressed={isFavorite}
                  disabled={toggleFavoriteMutation.isPending}
                  onClick={handleToggleFavorite}
                  className={isFavorite ? 'border-accent text-accent' : undefined}
                >
                  <Heart fill={isFavorite ? 'currentColor' : 'none'} />
                </Button>
              </div>
              {addFeedback && (
                <p role="status" className="text-sm text-muted-foreground">
                  {addFeedback}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <p>ID do token: {nft.tokenId}</p>
            <p>Coleção: {nft.collectionName}</p>
            <p>Atributos: {nft.attributes.join(', ')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Compartilhar este NFT:</span>
            <Button variant="outline" size="icon-sm" aria-label="Compartilhar" onClick={handleShare}>
              <Share2 />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Copiar link" onClick={handleCopyLink}>
              <Link2 />
            </Button>
          </div>
          {shareFeedback && (
            <p role="status" className="text-sm text-muted-foreground">
              {shareFeedback}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="flex flex-col gap-4">
        <div className="min-w-0 overflow-x-auto overflow-y-hidden">
          <TabsList variant="line" className="w-max max-w-full">
            <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
            <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewsCount})</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="details" className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Rede:</span> {NETWORK_LABELS[nft.network]}, com
            procedência imutável e metadados armazenados no IPFS.
          </p>
          <p>
            <span className="font-semibold text-foreground">Contrato:</span> {nft.contractAddress} • Contrato
            inteligente ERC-721 verificado.
          </p>
          <p>
            <span className="font-semibold text-foreground">Direitos autorais:</span> {nft.royaltyPercent}% em vendas
            secundárias, pagos automaticamente pelos marketplaces suportados.
          </p>
        </TabsContent>
        <TabsContent value="reviews" className="flex flex-col gap-4">
          {nft.reviews.map((review, i) => (
            <div key={i} className="flex gap-3 border-b border-border pb-4 last:border-none">
              <img src={review.avatarUrl} alt="" className="size-9 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{review.author}</span>
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, starIndex) => (
                      <Star key={starIndex} className="size-3" fill={starIndex < review.rating ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{review.comment}</p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {related && related.items.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="border-b border-border pb-3 text-sm font-bold">Mais desta coleção</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {related.items.map((relatedNft) => (
              <NftCard
                key={relatedNft.id}
                nft={relatedNft}
                isFavorite={favoriteIds.has(relatedNft.id)}
                onToggleFavorite={handleCardToggleFavorite}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

function NftDetailSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-360 flex-col gap-8 px-5 py-8 sm:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[96px_1fr_420px]">
        <Skeleton className="order-1 hidden rounded-xl lg:block" />
        <Skeleton className="order-1 aspect-square w-full rounded-xl lg:order-2" />
        <div className="order-3 flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </main>
  )
}
