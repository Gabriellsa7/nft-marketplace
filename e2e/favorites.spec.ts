import { expect, test } from '@playwright/test'
import { loginViaUi, setScenario, USERS } from './utils'

test.describe('Favoritos', () => {
  test('an unauthenticated visitor is redirected to login when favoriting', async ({ page }) => {
    await page.goto('/nfts/nft-1')
    // Scoped by test id: the detail page also renders a "Mais desta coleção" grid whose cards
    // have their own (unrelated) favorite buttons with the same accessible name.
    await page.getByTestId('nft-favorite-button').click()
    await page.waitForURL((url) => url.pathname === '/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toContain('/nfts/nft-1')
  })

  test('toggling a favorite persists for the authenticated user across a refresh', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    const favoritesLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/favorites') && res.request().method() === 'GET',
    )
    await page.goto('/nfts/nft-10')

    const favoriteButton = page.getByTestId('nft-favorite-button')
    // Wait for the initial favorites fetch (and React 19 StrictMode's dev-only double-mount
    // pass) to settle before interacting — clicking mid-remount can silently lose the click.
    await favoritesLoaded
    const addPersisted = page.waitForResponse(
      (res) => res.url().includes('/api/favorites/nft-10') && res.request().method() === 'POST',
    )
    await favoriteButton.click()
    await expect(favoriteButton).toHaveAccessibleName('Remover dos favoritos')
    // The UI flips optimistically before the write actually lands — wait for the real POST to
    // resolve (and persist to the mock db) before reloading, or the reload can race the request
    // and reload the page before it lands, making it look like the favorite never persisted.
    await addPersisted

    await page.reload()
    await expect(favoriteButton).toHaveAccessibleName('Remover dos favoritos')

    // Clean up: unfavorite so the fixture stays in its original state for other tests.
    const removePersisted = page.waitForResponse(
      (res) => res.url().includes('/api/favorites/nft-10') && res.request().method() === 'DELETE',
    )
    await favoriteButton.click()
    await expect(favoriteButton).toHaveAccessibleName('Adicionar aos favoritos')
    await removePersisted
  })

  test('a failed favorite mutation rolls back the optimistic UI update', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    const favoritesLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/favorites') && res.request().method() === 'GET',
    )
    await page.goto('/nfts/nft-11')
    const favoriteButton = page.getByTestId('nft-favorite-button')
    await expect(favoriteButton).toHaveAccessibleName('Adicionar aos favoritos')
    // The button renders (defaulting to "not favorited") before the favorites GET resolves —
    // wait for the real fetch so the mutation's optimistic-update baseline is actually cached.
    await favoritesLoaded

    await setScenario(page, 'offline')
    await favoriteButton.click()
    // Optimistic update applies immediately...
    await expect(favoriteButton).toHaveAccessibleName('Remover dos favoritos')
    // ...then rolls back once the mutation actually fails.
    await expect(favoriteButton).toHaveAccessibleName('Adicionar aos favoritos')

    await setScenario(page, 'default')
    await page.reload()
    await expect(favoriteButton).toHaveAccessibleName('Adicionar aos favoritos')
  })
})
