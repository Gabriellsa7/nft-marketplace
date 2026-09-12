import { expect, test } from '@playwright/test'
import { loginViaUi, setScenario, USERS } from './utils'

test.describe('Favoritos', () => {
  test('an unauthenticated visitor is redirected to login when favoriting', async ({ page }) => {
    await page.goto('/nfts/nft-1')
    await page.getByRole('button', { name: 'Adicionar aos favoritos' }).click()
    await page.waitForURL((url) => url.pathname === '/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toContain('/nfts/nft-1')
  })

  test('toggling a favorite persists for the authenticated user across a refresh', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await page.goto('/nfts/nft-10')

    const favoriteButton = page.getByRole('button', { name: 'Adicionar aos favoritos' })
    await favoriteButton.click()
    await expect(page.getByRole('button', { name: 'Remover dos favoritos' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Remover dos favoritos' })).toBeVisible()

    // Clean up: unfavorite so the fixture stays in its original state for other tests.
    await page.getByRole('button', { name: 'Remover dos favoritos' }).click()
    await expect(page.getByRole('button', { name: 'Adicionar aos favoritos' })).toBeVisible()
  })

  test('a failed favorite mutation rolls back the optimistic UI update', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    const favoritesLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/favorites') && res.request().method() === 'GET',
    )
    await page.goto('/nfts/nft-11')
    await expect(page.getByRole('button', { name: 'Adicionar aos favoritos' })).toBeVisible()
    // The button renders (defaulting to "not favorited") before the favorites GET resolves —
    // wait for the real fetch so the mutation's optimistic-update baseline is actually cached.
    await favoritesLoaded

    await setScenario(page, 'offline')
    await page.getByRole('button', { name: 'Adicionar aos favoritos' }).click()
    // Optimistic update applies immediately...
    await expect(page.getByRole('button', { name: 'Remover dos favoritos' })).toBeVisible()
    // ...then rolls back once the mutation actually fails.
    await expect(page.getByRole('button', { name: 'Adicionar aos favoritos' })).toBeVisible()

    await setScenario(page, 'default')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Adicionar aos favoritos' })).toBeVisible()
  })
})
