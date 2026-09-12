import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useNftsQuery } from '@/features/nfts/hooks'
import type { NftCategory, NftSortOption } from '@/types'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

interface CatalogSearch {
  search: string
  category: NftCategory | 'all'
  sort: NftSortOption
  page: number
}

const CATEGORY_OPTIONS: { value: NftCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas as categorias' },
  { value: 'art', label: 'Arte' },
  { value: 'collectibles', label: 'Colecionáveis' },
  { value: 'music', label: 'Música' },
  { value: 'photography', label: 'Fotografia' },
  { value: 'sports', label: 'Esportes' },
  { value: 'virtual-worlds', label: 'Mundos virtuais' },
]

const SORT_OPTIONS: { value: NftSortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'recent', label: 'Mais recentes' },
  { value: 'most-favorited', label: 'Mais favoritados' },
]

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label])) as Record<
  string,
  string
>

const SORT_LABELS = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label])) as Record<string, string>

export const Route = createFileRoute('/')({
  validateSearch: (raw: Record<string, unknown>): CatalogSearch => {
    const category = typeof raw.category === 'string' ? raw.category : 'all'
    const sort = typeof raw.sort === 'string' ? raw.sort : 'relevance'
    const page = Number(raw.page)
    return {
      search: typeof raw.search === 'string' ? raw.search : '',
      category: CATEGORY_OPTIONS.some((o) => o.value === category)
        ? (category as NftCategory | 'all')
        : 'all',
      sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as NftSortOption) : 'relevance',
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

  if (search.search !== syncedSearch) {
    setSyncedSearch(search.search)
    setSearchInput(search.search)
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== search.search) {
        navigate({
          search: (prev) => ({ ...prev, search: searchInput, page: 1 }),
        })
      }
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const { data, isPending, isError, isPlaceholderData, refetch } = useNftsQuery({
    search: search.search || undefined,
    category: search.category === 'all' ? undefined : search.category,
    sort: search.sort,
    page: search.page,
    pageSize: 12,
  })

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">NFT Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Descubra, colecione e negocie peças digitais únicas.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nome, coleção ou criador"
          aria-label="Buscar NFTs"
          className="sm:max-w-xs"
        />

        <Select
          value={search.category}
          onValueChange={(value) =>
            navigate({ search: (prev) => ({ ...prev, category: value as NftCategory | 'all', page: 1 }) })
          }
        >
          <SelectTrigger aria-label="Categoria" className="w-full sm:w-48">
            <SelectValue placeholder="Categoria">
              {(value: string) => CATEGORY_LABELS[value] ?? 'Categoria'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={search.sort}
          onValueChange={(value) =>
            navigate({ search: (prev) => ({ ...prev, sort: value as NftSortOption, page: 1 }) })
          }
        >
          <SelectTrigger aria-label="Ordenar por" className="w-full sm:w-48">
            <SelectValue placeholder="Ordenar por">
              {(value: string) => SORT_LABELS[value] ?? 'Ordenar por'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search.search || search.category !== 'all' || search.sort !== 'relevance') && (
          <Button
            variant="ghost"
            onClick={() => navigate({ search: { search: '', category: 'all', sort: 'relevance', page: 1 } })}
          >
            Limpar filtros
          </Button>
        )}
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
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Nenhum NFT encontrado para os filtros selecionados.</p>
        </div>
      )}

      {!isPending && !isError && data && data.items.length > 0 && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-busy={isPlaceholderData}
        >
          {data.items.map((nft) => (
            <Link
              key={nft.id}
              to="/nfts/$nftId"
              params={{ nftId: nft.id }}
              className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={nft.imageUrl}
                alt={nft.name}
                width={800}
                height={800}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <div className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{nft.name}</span>
                  <Badge variant="outline">{CATEGORY_LABELS[nft.category]}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{nft.collectionName}</span>
                <span className="mt-1 text-sm font-semibold">{nft.floorPriceEth} ETH</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={search.page <= 1}
                onClick={(e) => {
                  e.preventDefault()
                  if (search.page > 1) {
                    navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
                  }
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                Página {data.page} de {data.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={search.page >= data.totalPages}
                onClick={(e) => {
                  e.preventDefault()
                  if (search.page < data.totalPages) {
                    navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </main>
  )
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 overflow-hidden rounded-xl ring-1 ring-foreground/10">
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
