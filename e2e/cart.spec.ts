import { expect, test } from '@playwright/test'
import { addNftToCartAndOpenCart, loginViaUi, USERS } from './utils'

test.describe('Carrinho', () => {
  test('adding an item as a guest persists the cart across a refresh', async ({ page }) => {
    await addNftToCartAndOpenCart(page, 'nft-5')

    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Ir para pagamento' })).toBeEnabled()

    await page.reload()
    await expect(page.locator('tbody tr')).toHaveCount(1)
  })

  test('updating quantity and removing an item recomputes totals', async ({ page }) => {
    await addNftToCartAndOpenCart(page, 'nft-5')

    const row = page.locator('tbody tr').first()
    const increaseBtn = row.getByRole('button', { name: /^Aumentar quantidade/ })
    const decreaseBtn = row.getByRole('button', { name: /^Diminuir quantidade/ })

    await expect(row.locator('[aria-live="polite"]')).toHaveText('1')
    await increaseBtn.click()
    await expect(row.locator('[aria-live="polite"]')).toHaveText('2')

    const lineTotalCell = row.locator('td').nth(3)
    await expect(lineTotalCell).toBeVisible()

    await decreaseBtn.click()
    await expect(row.locator('[aria-live="polite"]')).toHaveText('1')

    await row.getByRole('button', { name: /^Remover/ }).click()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('applying a coupon updates the summary; invalid and expired codes are rejected', async ({ page }) => {
    await addNftToCartAndOpenCart(page, 'nft-5')

    await page.getByLabel('Código promocional').fill('NOPE-INVALID')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom inválido.')).toBeVisible()

    // Applying speculatively switches the UI into "coupon applied" mode even when the code
    // turns out to be invalid — "Remover" clears it so a different code can be entered.
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await page.getByLabel('Código promocional').fill('EXPIRED5')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este cupom expirou.')).toBeVisible()

    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await page.getByLabel('Código promocional').fill('WELCOME10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText(/Desconto \(WELCOME10\)/)).toBeVisible()

    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByText(/Desconto/)).not.toBeVisible()
  })

  test("a guest's cart merges into the account cart on login", async ({ page }) => {
    await addNftToCartAndOpenCart(page, 'nft-6')
    await expect(page.locator('tbody tr')).toHaveCount(1)

    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/cart')
    await expect(page.locator('tbody tr')).toHaveCount(1)
  })
})
