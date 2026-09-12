import { expect, test } from '@playwright/test'
import { loginViaUi, USERS } from './utils'

// Baselines are versioned under e2e/visual.spec.ts-snapshots/ (generated the first time this
// suite runs with --update-snapshots) and are project-scoped, so chromium (desktop) and
// mobile-chromium (Pixel 7) each get their own reference images automatically.

test.describe('Regressão visual', () => {
  test('início', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
    await expect(page).toHaveScreenshot('home.png', {
      fullPage: true,
      mask: [page.getByRole('button', { name: 'Open Tanstack query devtools' })],
    })
  })

  test('detalhe do NFT', async ({ page }) => {
    await page.goto('/nfts/nft-0')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).toHaveScreenshot('nft-detail.png', {
      fullPage: true,
      mask: [page.getByRole('button', { name: 'Open Tanstack query devtools' })],
    })
  })

  test('carrinho', async ({ page }) => {
    await page.goto('/nfts/nft-0')
    await page.getByRole('button', { name: 'COMPRAR' }).click()
    await page.getByText('Item adicionado ao carrinho.').waitFor()
    await page.goto('/cart')
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page).toHaveScreenshot('cart.png', {
      fullPage: true,
      mask: [page.getByRole('button', { name: 'Open Tanstack query devtools' })],
    })
  })

  test('pagamento', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/nfts/nft-0')
    await page.getByRole('button', { name: 'COMPRAR' }).click()
    await page.getByText('Item adicionado ao carrinho.').waitFor()
    await page.goto('/checkout')
    await expect(page.locator('aside').getByText('Total', { exact: true })).toBeVisible()
    await expect(page).toHaveScreenshot('checkout.png', {
      fullPage: true,
      mask: [page.getByRole('button', { name: 'Open Tanstack query devtools' })],
    })
  })
})
