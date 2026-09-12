import { expect, test } from '@playwright/test'
import { setScenario } from './utils'

test.describe('Skeletons, falha de carregamento e recuperação', () => {
  test('the catalog shows shimmering skeletons while data is slow to load', async ({ page }) => {
    await page.goto('/?mock_scenario=slow')
    await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible()
    await expect(page.locator('a[href^="/nfts/"]').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  })

  test('the NFT detail page shows skeletons while slow, then renders content', async ({ page }) => {
    await page.goto('/nfts/nft-1?mock_scenario=slow')
    // The gallery-rail skeleton is desktop-only (hidden below lg); the main image one isn't.
    await expect(page.locator('[data-slot="skeleton"]:visible').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('a cart-summary fetch failure recovers once the network condition improves', async ({ page }) => {
    await page.goto('/nfts/nft-2')
    await page.getByRole('button', { name: 'COMPRAR' }).click()
    await page.getByText('Item adicionado ao carrinho.').waitFor()

    await setScenario(page, 'offline')
    await page.goto('/cart')
    await expect(page.getByText('Não foi possível carregar o carrinho.')).toBeVisible()

    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByText('Não foi possível carregar o carrinho.')).not.toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(1)
  })
})
