import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { NftCard } from '@/components/nft-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSessionQuery } from '@/features/auth/hooks'
import { useFavoritesQuery, useToggleFavoriteMutation } from '@/features/favorites/hooks'
import { useNftsQuery } from '@/features/nfts/hooks'
import { DEFAULT_CATALOG_SEARCH, type CatalogSearch } from '@/lib/catalog-search'
import { CATEGORY_OPTIONS, NETWORK_OPTIONS } from '@/lib/nft-labels'
import type { Nft, NftCategory, NftNetwork, NftSortOption } from '@/types'
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const PRICE_MIN = 0
const PRICE_MAX = 10

const SORT_TABS: { value: NftSortOption; label: string }[] = [
  { value: 'relevance', label: 'Todos os NFTs' },
  { value: 'recent', label: 'Novos lançamentos' },
  { value: 'most-favorited', label: 'Em alta' },
]

function toStringParam(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export const Route = createFileRoute('/')({
  validateSearch: (raw: Record<string, unknown>): CatalogSearch => {
    const category = toStringParam(raw.category, 'all')
    const network = toStringParam(raw.network, 'all')
    const sort = toStringParam(raw.sort, 'relevance')
    const page = Number(raw.page)
    return {
      search: toStringParam(raw.search, ''),
      category: CATEGORY_OPTIONS.some((o) => o.value === category) ? (category as NftCategory) : 'all',
      network: NETWORK_OPTIONS.some((o) => o.value === network) ? (network as NftNetwork) : 'all',
      minPrice: toStringParam(raw.minPrice, ''),
      maxPrice: toStringParam(raw.maxPrice, ''),
      sort: ['relevance', 'recent', 'most-favorited', 'price-asc', 'price-desc'].includes(sort)
        ? (sort as NftSortOption)
        : 'relevance',
      page: Number.isInteger(page) && page > 0 ? page : 1,
    }
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [searchInput, setSearchInput] = useState(search.search)
  const [syncedSearch, setSyncedSearch] = useState(search.search)
  const [priceInputs, setPriceInputs] = useState({ min: search.minPrice, max: search.maxPrice })

  if (search.search !== syncedSearch) {
    setSyncedSearch(search.search)
    setSearchInput(search.search)
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== search.search) {
        navigate({ search: (prev) => ({ ...prev, search: searchInput, page: 1 }) })
      }
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const { data, isPending, isError, isPlaceholderData, refetch } = useNftsQuery({
    search: search.search || undefined,
    category: search.category === 'all' ? undefined : search.category,
    network: search.network === 'all' ? undefined : search.network,
    minPrice: search.minPrice || undefined,
    maxPrice: search.maxPrice || undefined,
    sort: search.sort,
    page: search.page,
    pageSize: 12,
  })

  const location = useRouterState({ select: (s) => s.location })
  const { data: user } = useSessionQuery()
  const { data: favorites } = useFavoritesQuery(Boolean(user))
  const favoriteIds = new Set(favorites?.map((f) => f.id))
  const toggleFavoriteMutation = useToggleFavoriteMutation()

  function handleToggleFavorite(e: React.MouseEvent, nft: Nft) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      navigate({ to: '/login', search: { redirect: location.href } })
      return
    }
    toggleFavoriteMutation.mutate({ nftId: nft.id, isFavorite: favoriteIds.has(nft.id), nft })
  }

  function applyPriceRange() {
    navigate({ search: (prev) => ({ ...prev, minPrice: priceInputs.min, maxPrice: priceInputs.max, page: 1 }) })
  }

  const hasActiveFilters =
    search.search ||
    search.category !== 'all' ||
    search.network !== 'all' ||
    search.minPrice ||
    search.maxPrice ||
    search.sort !== 'relevance'

  return (
    <main className="flex flex-col gap-14 pb-16">
        <section className="mx-auto w-full max-w-360 px-5 pt-8 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <span className="text-sm text-muted-foreground">Bem-vindo à Kurio</span>
              <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                SEJA DONO DO FUTURO DA ARTE DIGITAL
              </h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital
                rara, apoie artistas e tenha uma parte da cultura da internet.
              </p>
              <Button
                size="lg"
                className="w-fit"
                nativeButton={false}
                render={<a href="#catalogo" />}
              >
                EXPLORAR
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              <img
                src="/img/main-img.png"
                alt=""
                fetchPriority="high"
                className="aspect-square w-full object-cover"
              />
            </div>
          </div>
        </section>

        <section id="catalogo" className="mx-auto grid w-full max-w-360 grid-cols-1 gap-8 px-5 sm:px-8 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col gap-8">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold">Coleções</h2>
              <ul className="flex flex-col gap-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <label className="group flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <Checkbox
                        checked={search.category === opt.value}
                        onCheckedChange={(checked) =>
                          navigate({
                            search: (prev) => ({ ...prev, category: checked ? opt.value : 'all', page: 1 }),
                          })
                        }
                      />
                      {opt.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold">Faixa de preço</h2>
              <p className="text-xs text-muted-foreground">
                Preço: {priceInputs.min === '' ? PRICE_MIN.toFixed(2) : Number(priceInputs.min).toFixed(2)} -{' '}
                {priceInputs.max === '' ? PRICE_MAX.toFixed(2) : Number(priceInputs.max).toFixed(2)} ETH
              </p>
              <Slider
                aria-label="Faixa de preço em ETH"
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={0.1}
                value={[
                  priceInputs.min === '' ? PRICE_MIN : Number(priceInputs.min),
                  priceInputs.max === '' ? PRICE_MAX : Number(priceInputs.max),
                ]}
                onValueChange={(value) => {
                  const [min, max] = value as number[]
                  setPriceInputs({ min: min.toFixed(2), max: max.toFixed(2) })
                }}
                className="py-1"
              />
              <Button size="sm" variant="secondary" onClick={applyPriceRange}>
                Aplicar
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold">Rede</h2>
              <ul className="flex flex-col gap-2">
                {NETWORK_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <label className="group flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <Checkbox
                        checked={search.network === opt.value}
                        onCheckedChange={(checked) =>
                          navigate({
                            search: (prev) => ({ ...prev, network: checked ? opt.value : 'all', page: 1 }),
                          })
                        }
                      />
                      {opt.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPriceInputs({ min: '', max: '' })
                  navigate({ search: DEFAULT_CATALOG_SEARCH })
                }}
              >
                Limpar filtros
              </Button>
            )}
          </aside>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={search.sort}
                onValueChange={(value) =>
                  navigate({ search: (prev) => ({ ...prev, sort: value as NftSortOption, page: 1 })  })
                }
              >
                <TabsList variant="line">
                  {SORT_TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nome, coleção ou criador"
                aria-label="Buscar NFTs"
                className="sm:max-w-xs"
              />
            </div>

            {isError && (
              <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <p>Não foi possível carregar o catálogo. Tente novamente.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {isPending && <CatalogSkeleton />}

            {!isPending && !isError && data && data.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
                <p>Nenhum NFT encontrado para os filtros selecionados.</p>
              </div>
            )}

            {!isPending && !isError && data && data.items.length > 0 && (
              <div
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                aria-busy={isPlaceholderData}
              >
                {data.items.map((nft) => (
                  <NftCard
                    key={nft.id}
                    nft={nft}
                    isFavorite={favoriteIds.has(nft.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}

            {data && data.totalPages > 1 && (
              <Pagination className="justify-start pt-2">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={search.page <= 1}
                      onClick={(e) => {
                        e.preventDefault()
                        if (search.page > 1) navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        isActive={pageNum === search.page}
                        onClick={(e) => {
                          e.preventDefault()
                          navigate({ search: (prev) => ({ ...prev, page: pageNum }) })
                        }}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={search.page >= data.totalPages}
                      onClick={(e) => {
                        e.preventDefault()
                        if (search.page < data.totalPages)
                          navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </section>
    </main>
  )
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 overflow-hidden rounded-xl ring-1 ring-border">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
