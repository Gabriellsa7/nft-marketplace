import { expect, test } from '@playwright/test'
import { loginViaUi, USERS } from './utils'

test.describe('Perfil, senha e carteiras', () => {
  test('editing the profile name/email persists after a refresh', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/profile')

    await page.getByLabel('Nome').fill('Ana Souza Atualizada')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Nome')).toHaveValue('Ana Souza Atualizada')

    // Restore the fixture name so other tests relying on "Ana Souza" keep working.
    await page.getByLabel('Nome').fill(USERS.ana.name)
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
  })

  test('profile update surfaces a validation error for an invalid email', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/profile')

    await page.getByLabel('E-mail', { exact: true }).fill('not-an-email')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  })

  test('changing the password rejects a wrong current password, then succeeds', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await page.goto('/profile')

    await page.getByLabel('Senha atual').fill('wrong-current-password')
    await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha123')
    await page.getByLabel('Confirmar nova senha').fill('novaSenha123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

    await page.getByLabel('Senha atual').fill(USERS.bruno.password)
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()

    // Restore the original password for other tests/sessions using this fixture user.
    await page.getByLabel('Senha atual').fill('novaSenha123')
    await page.getByLabel('Nova senha', { exact: true }).fill(USERS.bruno.password)
    await page.getByLabel('Confirmar nova senha').fill(USERS.bruno.password)
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()
  })

  test('wallet form validates the address format and rejects a duplicate', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/wallets')

    await page.getByRole('button', { name: 'Adicionar' }).click()
    await page.getByLabel('Nome').fill('Carteira inválida')
    await page.getByLabel('Endereço').fill('not-a-valid-address')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Endereço inválido. Use o formato 0x seguido de 40 caracteres.')).toBeVisible()

    // Ana's existing wallet address, from the seed fixtures.
    await page.getByLabel('Endereço').fill('0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Endereço já cadastrado.')).toBeVisible()
  })

  test('adding then editing a wallet succeeds and persists', async ({ page }) => {
    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await page.goto('/wallets')

    await page.getByRole('button', { name: 'Adicionar' }).click()
    await page.getByLabel('Nome').fill('Carteira de teste')
    await page.getByLabel('Endereço').fill('0x9999888877776666555544443333222211110000')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Carteira de teste')).toBeVisible()

    await page
      .locator('li', { hasText: 'Carteira de teste' })
      .getByRole('button', { name: 'Editar' })
      .click()
    await page.getByLabel('Nome').fill('Carteira renomeada')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Carteira renomeada')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Carteira renomeada')).toBeVisible()
  })
})
