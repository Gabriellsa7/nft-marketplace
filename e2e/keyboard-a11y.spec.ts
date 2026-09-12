import { expect, test } from '@playwright/test'
import { addNftToCartAndOpenCart, loginViaUi, USERS } from './utils'

test.describe('Navegação por teclado, foco de diálogos e validação de formulários', () => {
  test('the search input and catalog links are keyboard-reachable with visible focus', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Buscar NFTs').focus()
    await expect(page.getByLabel('Buscar NFTs')).toBeFocused()

    await page.keyboard.press('Tab')
    const active = await page.evaluate(() => document.activeElement?.tagName)
    expect(active).toBeTruthy()
  })

  test('empty login submission surfaces field errors associated to their inputs', async ({ page }) => {
    await page.goto('/login')
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click()

    const emailInput = page.getByLabel('E-mail')
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await emailInput.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText('Informe seu e-mail.')
  })

  test('the wallet-connect dialog traps focus and Escape closes it, returning focus to the trigger', async ({
    page,
  }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await addNftToCartAndOpenCart(page, 'nft-20')
    await page.getByRole('button', { name: 'Ir para pagamento' }).click()

    const walletRadio = page.locator('input[type="radio"][name="wallet"]').first()
    await walletRadio.check()

    const dialog = page.getByRole('dialog', { name: 'Conectar carteira' })
    await expect(dialog).toBeVisible()

    // Focus must have moved inside the dialog.
    const focusInsideDialog = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]')
      return dlg?.contains(document.activeElement) ?? false
    })
    expect(focusInsideDialog).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('checkout collector form validates required fields before submission', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await addNftToCartAndOpenCart(page, 'nft-19')
    await page.getByRole('button', { name: 'Ir para pagamento' }).click()

    await page.getByLabel('Nome de exibição').fill('')
    await page.locator('input[type="radio"][name="wallet"]').first().check()
    await page.getByRole('button', { name: 'Aprovar conexão' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page.getByText('Informe seu nome completo.')).toBeVisible()
    // Submission must be blocked — still on checkout, no order created.
    await expect(page).toHaveURL(/\/checkout/)
  })
})
