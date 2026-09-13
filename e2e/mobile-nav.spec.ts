import { expect, test } from '@playwright/test'
import { loginViaUi, USERS } from './utils'

test.describe('Navegação mobile — tab bar e favoritos', () => {
  test('the bottom tab bar shows only below the desktop breakpoint', async ({ page }, testInfo) => {
    await page.goto('/')
    const tabBar = page.getByRole('navigation', { name: 'Navegação principal' })
    if (testInfo.project.name === 'mobile-chromium') {
      await expect(tabBar).toBeVisible()
    } else {
      await expect(tabBar).toBeHidden()
    }
  })

  test('tapping "Favoritos" while logged out redirects to login and back', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'tab bar only renders below the md breakpoint')

    await page.goto('/')
    const tabBar = page.getByRole('navigation', { name: 'Navegação principal' })
    await tabBar.getByRole('link', { name: 'Favoritos' }).click()
    await page.waitForURL((url) => url.pathname === '/login')
    expect(new URL(page.url()).searchParams.get('redirect')).toContain('/favorites')

    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/favorites')
    await expect(page.getByRole('heading', { name: 'Favoritos' })).toBeVisible()
    // Seeded fixture data: ana already has two favorited NFTs.
    await expect(page.locator('a[href^="/nfts/"]')).toHaveCount(2)
  })

  test('the "Mercado" FAB and "Início" both open the catalog, "Carrinho" opens the cart', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'tab bar only renders below the md breakpoint')

    // Scoped to the tab bar landmark: the detail page's own breadcrumb also has "Início"/
    // "Mercado" links, and the header's cart icon (not `md:`-gated) also reads "Carrinho".
    const tabBar = page.getByRole('navigation', { name: 'Navegação principal' })

    await page.goto('/nfts/nft-0')
    await tabBar.getByRole('link', { name: 'Mercado' }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/')

    await page.goto('/nfts/nft-0')
    await tabBar.getByRole('link', { name: 'Carrinho' }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/cart')

    await tabBar.getByRole('link', { name: 'Início' }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  })
})
