import { expect, test } from '@playwright/test'
import { addNftToCartViaUi, getAuthToken, loginViaUi, resolveOrder, USERS } from './utils'

async function connectFirstWallet(page: import('@playwright/test').Page) {
  await page.locator('input[type="radio"][name="wallet"]').first().check()
  await page.getByRole('button', { name: 'Aprovar conexão' }).click()
  await expect(page.getByText('Conectada')).toBeVisible()
}

test.describe('Falha de pagamento, idempotência e recuperação', () => {
  test('a declined order preserves the cart item and lets the collector try again', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await addNftToCartViaUi(page, 'nft-12')

    await page.goto('/checkout')
    await connectFirstWallet(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.waitForURL((url) => /\/orders\/.+/.test(url.pathname))
    const orderId = page.url().split('/orders/')[1]

    await resolveOrder(page, orderId, 'declined')
    await expect(page.getByRole('heading', { name: 'Não foi possível confirmar seu pedido' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Recusado')).toBeVisible()
    await expect(page.getByText('Nenhum valor foi cobrado e os itens continuam disponíveis para nova compra.')).toBeVisible()

    // The item must still be in the cart — only a confirmed order removes it.
    await page.goto('/cart')
    await expect(page.locator('tbody tr')).toHaveCount(1)
  })

  test('reusing an idempotency key returns the same order; reusing it with different content conflicts', async ({
    page,
  }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await addNftToCartViaUi(page, 'nft-13')
    await page.goto('/checkout')
    await connectFirstWallet(page)

    const token = await getAuthToken(page)
    const idempotencyKey = crypto.randomUUID()

    const body = await page.evaluate(async () => {
      // Read the same values the checkout form would submit.
      const wallets: { id: string; network: string }[] = await (
        await fetch('/api/wallets', { headers: { Authorization: `Bearer ${localStorage.getItem('nft-marketplace-auth-token')}` } })
      )
        .json()
        .then((r) => r.items)
      return wallets[0]
    })

    const quoteBody = await page.evaluate(async () => {
      const res = await fetch('/api/cart', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nft-marketplace-auth-token')}` },
      })
      const cart = await res.json()
      const items = cart.items.map((i: { nftId: string; editionId: string; quantity: number }) => ({
        nftId: i.nftId,
        editionId: i.editionId,
        quantity: i.quantity,
      }))
      const quoteRes = await fetch('/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('nft-marketplace-auth-token')}`,
        },
        body: JSON.stringify({ items }),
      })
      return quoteRes.json()
    })

    const orderInput = {
      quoteVersion: quoteBody.quoteVersion,
      walletId: body.id,
      network: body.network,
      collectorName: 'Ana Souza',
      collectorEmail: 'ana@demo.nft',
    }

    async function createOrder(input: typeof orderInput, key: string) {
      return page.evaluate(
        async ({ input, key, token }) => {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': key,
            },
            body: JSON.stringify(input),
          })
          return { status: res.status, body: await res.json() }
        },
        { input, key, token },
      )
    }

    const first = await createOrder(orderInput, idempotencyKey)
    expect(first.status).toBe(201)

    // Same key, identical body — must return the very same order, not create a second one.
    const second = await createOrder(orderInput, idempotencyKey)
    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)

    // Same key, different body — must conflict rather than silently accept new content.
    const third = await createOrder({ ...orderInput, collectorName: 'Someone Else' }, idempotencyKey)
    expect(third.status).toBe(409)
    expect(third.body.code).toBe('idempotency_conflict')
  })

  test('repeated clicks on submit only create one order', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await addNftToCartViaUi(page, 'nft-14')
    await page.goto('/checkout')
    await connectFirstWallet(page)

    const submitButton = page.getByRole('button', { name: 'Confirmar compra' })
    await Promise.all([submitButton.click(), submitButton.click({ force: true }).catch(() => {})])

    await page.waitForURL((url) => /\/orders\/.+/.test(url.pathname))
    const orderId = page.url().split('/orders/')[1]
    await resolveOrder(page, orderId, 'confirmed')

    // The cart had exactly one item purchased — if a duplicate order had slipped through,
    // confirming it would have removed more than the one quantity actually bought, or the
    // checkout guard would have had a second, still-pending order left dangling.
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })
})
