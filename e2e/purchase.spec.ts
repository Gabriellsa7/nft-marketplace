import { expect, test } from '@playwright/test'
import { addNftToCartViaUi, loginViaUi, resolveOrder, setScenario, simulateNftUpdate, USERS } from './utils'

async function connectFirstWallet(page: import('@playwright/test').Page) {
  await page.locator('input[type="radio"][name="wallet"]').first().check()
  await page.getByRole('button', { name: 'Aprovar conexão' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
}

test.describe('Compra completa — do catálogo ao recibo confirmado', () => {
  test('catalog to confirmed receipt, and the receipt snapshot is immune to later catalog changes', async ({
    page,
  }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await addNftToCartViaUi(page, 'nft-8')

    await page.goto('/checkout')
    await connectFirstWallet(page)

    const totalBefore = await page.locator('aside').getByText(/^\d+\.\d{4} ETH$/).last().innerText()

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.waitForURL((url) => /\/orders\/.+/.test(url.pathname))
    const orderId = page.url().split('/orders/')[1]

    await expect(page.getByText('Processando seu pedido')).toBeVisible()

    await resolveOrder(page, orderId, 'confirmed')
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Confirmado')).toBeVisible()

    const total = await page.getByText('Total').last().locator('..').innerText()
    expect(total).toContain(totalBefore.replace(' ETH', ''))

    // Cart is emptied only of the purchased item, only after confirmation.
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()

    // A later catalog price change for the same NFT must not retroactively alter the receipt.
    await simulateNftUpdate(page, 'nft-8', { priceEth: '999.9999' })
    await page.goto(`/orders/${orderId}`)
    await expect(page.getByText('999.9999 ETH')).not.toBeVisible()
  })

  test('a price change during checkout blocks confirmation until the collector re-reviews', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await addNftToCartViaUi(page, 'nft-9')

    await page.goto('/checkout')
    await connectFirstWallet(page)
    await expect(page.locator('aside').getByText('Total', { exact: true })).toBeVisible()

    // Slow down every other mocked endpoint so the realtime-triggered background refetch of
    // the quote/cart queries cannot race ahead of this test's own click below.
    await setScenario(page, 'slow')
    await simulateNftUpdate(page, 'nft-9', { editionId: 'nft-9-edition-0', priceEth: '55.5000' })

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Os valores foram atualizados. Revise o pedido e confirme novamente.')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page).toHaveURL(/\/checkout/)

    await setScenario(page, 'default')
    await expect(page.locator('aside').getByText(/55\.5/)).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.waitForURL((url) => /\/orders\/.+/.test(url.pathname))
  })
})
