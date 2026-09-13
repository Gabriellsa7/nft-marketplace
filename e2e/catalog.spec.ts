import { expect, test } from '@playwright/test'
import { setScenario } from './utils'

test.describe('Catálogo — busca, filtros, ordenação e paginação', () => {
  test('home renders the hero and the catalog grid', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'SEJA DONO DO FUTURO DA ARTE DIGITAL' })).toBeVisible()
    await expect(page.getByRole('link', { name: /#1/ }).first()).toBeVisible()
  })

  test('search updates the URL, filters results, and survives a refresh', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Buscar NFTs').fill('Kurio Apes')
    await page.waitForURL((url) => url.searchParams.get('search') === 'Kurio Apes')
    await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')

    const cards = page.locator('a[href^="/nfts/"]')
    await expect(cards.first()).toBeVisible()
    const texts = await cards.allTextContents()
    expect(texts.length).toBeGreaterThan(0)
    for (const text of texts) {
      expect(text).toContain('Kurio Apes')
    }

    await page.reload()
    await expect(page.getByLabel('Buscar NFTs')).toHaveValue('Kurio Apes')
    await expect(cards.first()).toBeVisible()
  })

  test('combining category and sort filters resets pagination to page 1 and survives back/forward', async ({
    page,
  }) => {
    await page.goto('/?search=&category=all&minPrice=&maxPrice=&sort=relevance&page=1')

    // Move to page 2 first (pagination controls render as Button-styled links, role "button").
    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.waitForURL((url) => url.searchParams.get('page') === '2')

    // Applying a category filter must reset back to page 1.
    await page.getByRole('checkbox', { name: 'Arte digital' }).click()
    await page.waitForURL(
      (url) => url.searchParams.get('category') === 'art' && (url.searchParams.get('page') ?? '1') === '1',
    )

    // Combine with a sort tab — still page 1, both params present together.
    await page.getByRole('tab', { name: 'Novos lançamentos' }).click()
    await page.waitForURL(
      (url) => url.searchParams.get('sort') === 'recent' && url.searchParams.get('category') === 'art',
    )

    const urlAfterFilters = page.url()

    await page.goBack()
    await page.waitForURL((url) => url.searchParams.get('sort') !== 'recent')
    await page.goForward()
    await expect(page).toHaveURL(urlAfterFilters)
    await expect(page.getByRole('checkbox', { name: 'Arte digital' })).toBeChecked()
  })

  test('an unmatched filter combination shows the empty state', async ({ page }) => {
    await page.goto('/?search=&category=all&minPrice=999&maxPrice=999.5&sort=relevance&page=1')
    await expect(page.getByText('Nenhum NFT encontrado para os filtros selecionados.')).toBeVisible()
  })

  test('catalog failure shows an error with retry, which recovers on success', async ({ page }) => {
    await page.goto('/?mock_scenario=offline')
    await expect(page.getByText('Não foi possível carregar o catálogo. Tente novamente.')).toBeVisible()

    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByText('Não foi possível carregar o catálogo. Tente novamente.')).not.toBeVisible()
    await expect(page.locator('a[href^="/nfts/"]').first()).toBeVisible()
  })

  test('clearing filters restores the default catalog view', async ({ page }) => {
    await page.goto('/?search=Kurio&category=art&minPrice=&maxPrice=&sort=relevance&page=1')
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await page.waitForURL((url) => !url.searchParams.get('search') && url.searchParams.get('category') === 'all')
    await expect(page.getByLabel('Buscar NFTs')).toHaveValue('')
  })

  test('the "Rede" filter narrows results to one network at a time', async ({ page }) => {
    await page.goto('/?search=&category=all&network=all&minPrice=&maxPrice=&sort=relevance&page=1')
    await expect(page.locator('a[href^="/nfts/"]').first()).toBeVisible()

    await page.getByRole('checkbox', { name: 'Ethereum' }).click()
    await page.waitForURL(
      (url) => url.searchParams.get('network') === 'ethereum' && (url.searchParams.get('page') ?? '1') === '1',
    )
    await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
    const ethereumHrefs = await page
      .locator('a[href^="/nfts/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
    expect(ethereumHrefs.length).toBeGreaterThan(0)

    // Switch straight to a different network — each NFT belongs to exactly one, so the two
    // result sets must be disjoint if the filter is actually taking effect server-side.
    await page.getByRole('checkbox', { name: 'Ethereum' }).click()
    await page.getByRole('checkbox', { name: 'Polygon' }).click()
    await page.waitForURL((url) => url.searchParams.get('network') === 'polygon')
    await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
    const polygonHrefs = await page
      .locator('a[href^="/nfts/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
    expect(polygonHrefs.length).toBeGreaterThan(0)
    expect(ethereumHrefs.some((href) => polygonHrefs.includes(href))).toBe(false)

    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await page.waitForURL((url) => url.searchParams.get('network') === 'all')
  })

  test('the price-range slider narrows results and updates the URL', async ({ page }) => {
    await page.goto('/?search=&category=all&network=all&minPrice=&maxPrice=&sort=relevance&page=1')
    await expect(page.locator('a[href^="/nfts/"]').first()).toBeVisible()
    const unfilteredHrefs = await page
      .locator('a[href^="/nfts/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))

    // Drag the max-price handle down via keyboard (also exercises its accessible name/keyboard
    // operability) rather than a real pointer drag, which needs the element scrolled into view.
    const maxThumb = page.getByRole('slider', { name: 'Preço máximo em ETH' })
    await maxThumb.focus()
    for (let i = 0; i < 85; i++) await page.keyboard.press('ArrowLeft')
    await expect(page.getByText('Preço: 0.00 - 10.00 ETH')).not.toBeVisible()

    await page.getByRole('button', { name: 'Aplicar' }).click()
    await page.waitForURL((url) => Boolean(url.searchParams.get('maxPrice')))
    await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')

    const filteredHrefs = await page
      .locator('a[href^="/nfts/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
    expect(filteredHrefs.length).toBeGreaterThan(0)
    expect(filteredHrefs.length).toBeLessThan(unfilteredHrefs.length)

    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await page.waitForURL((url) => !url.searchParams.get('maxPrice'))
  })
})

test.describe('Detalhe do NFT — acesso direto e recurso inexistente', () => {
  test('direct navigation to an existing NFT renders its details', async ({ page }) => {
    await page.goto('/nfts/nft-0')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /COMPRAR/ })).toBeVisible()
  })

  test('direct navigation to a nonexistent NFT shows a not-found state, not a crash', async ({ page }) => {
    await page.goto('/nfts/does-not-exist')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('button', { name: 'Voltar ao catálogo' }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  })
})
