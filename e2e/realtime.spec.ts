import { expect, test } from '@playwright/test'
import { addNftToCartAndOpenCart, loginViaUi, resolveOrder, simulateNftUpdate, USERS } from './utils'

test.describe('Tempo real — reconexão, duplicatas e retomada de pedido pendente', () => {
  test('a price/availability change while the NFT is in the cart is reflected without a refresh', async ({
    page,
  }) => {
    await addNftToCartAndOpenCart(page, 'nft-15')
    const row = page.locator('tbody tr').first()
    const priceCellBefore = await row.locator('td').nth(1).innerText()

    await simulateNftUpdate(page, 'nft-15', { editionId: 'nft-15-edition-0', priceEth: '42.4242' })

    await expect(row.getByText(/preço|disponibilidade/i)).toBeVisible({ timeout: 10_000 })
    await expect(row.locator('td').nth(1)).toHaveText('42.4242 ETH')
    const priceCellAfter = await row.locator('td').nth(1).innerText()
    expect(priceCellAfter).not.toBe(priceCellBefore)
  })

  test('rapid duplicate/out-of-order nft.updated events never regress the displayed state', async ({ page }) => {
    await page.goto('/nfts/nft-16')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Fire an older-looking (lower price) update first, then a newer one — the client must
    // land on the latest version, not the one that merely arrived first in a duplicate burst.
    await simulateNftUpdate(page, 'nft-16', { editionId: 'nft-16-edition-0', priceEth: '10.0000' })
    await simulateNftUpdate(page, 'nft-16', { editionId: 'nft-16-edition-0', priceEth: '20.0000' })

    await expect(page.getByText('20.0000 ETH', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('10.0000 ETH')).not.toBeVisible()
  })

  test('a pending order survives a page reload (disconnect/reconnect) without duplicating the purchase', async ({
    page,
  }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await addNftToCartAndOpenCart(page, 'nft-17')
    await page.getByRole('button', { name: 'Ir para pagamento' }).click()

    await page.locator('input[type="radio"][name="wallet"]').first().check()
    await page.getByRole('button', { name: 'Aprovar conexão' }).click()
    await expect(page.getByText('Conectada')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await page.waitForURL((url) => /\/orders\/.+/.test(url.pathname))
    const orderUrl = page.url()
    await expect(page.getByText('Processando seu pedido')).toBeVisible()

    // Simulate a dropped connection + reload while the order is still pending — recovery must
    // read the same order back via REST, not let the collector place a second purchase.
    await page.reload()
    await expect(page).toHaveURL(orderUrl)
    await expect(page.getByText('Processando seu pedido')).toBeVisible()

    const orderId = orderUrl.split('/orders/')[1]
    await resolveOrder(page, orderId, 'confirmed')
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({
      timeout: 10_000,
    })

    // Cart is empty — nothing left over from a hypothetical duplicate order.
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })
})
