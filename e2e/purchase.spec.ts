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
    // Assert on the quote's own "Subtotal" (data-testid, not text matching): the cart line
    // item's unit price renders the same "55.5000 ETH" text once it also re-renders, which
    // made an unscoped/text-based match here ambiguous (strict-mode violation).
    await expect(page.getByTestId('quote-subtotal')).toHaveText(/55\.5/, { timeout: 10_000 })

    // Resubmission also re-validates the cart's per-item priceChanged/availabilityChanged
    // flags (checkout.tsx's handleConfirm), which the mock cart handler only clears on the
    // *next* /api/cart fetch after a price change — a separate query from the quote checked
    // above, so it can still be mid-flight once the quote has already settled. Rather than
    // pin an exact wait for that internal fetch, retry the confirm: a real collector would
    // just click "Confirmar compra" again if told to review and confirm once more.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      const navigated = await page
        .waitForURL((url) => /\/orders\/.+/.test(url.pathname), { timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
      if (navigated) break
      expect(attempt, 'resubmission kept getting rejected as stale').toBeLessThan(3)
      await expect(page.getByText('Os valores foram atualizados. Revise o pedido e confirme novamente.')).toBeVisible()
    }
  })
})
