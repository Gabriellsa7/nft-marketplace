import { expect, test } from '@playwright/test'
import { expireSession, loginViaUi, USERS } from './utils'

test.describe('Cadastro, login, expiração de sessão, logout e troca de usuário', () => {
  test('register creates an account, auto-logs in, and the session survives a refresh', async ({ page }) => {
    const email = `collector-${Date.now()}@demo.nft`
    await page.goto('/register')
    await page.getByLabel('Nome').fill('Nova Colecionadora')
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill('senha123')
    await page.getByLabel('Confirmar senha').fill('senha123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await page.waitForURL((url) => url.pathname === '/')
    await expect(page.getByRole('button', { name: 'Nova' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Nova' })).toBeVisible()
  })

  test('register rejects a duplicate email with an inline field error', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Nome').fill('Ana Duplicada')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('senha123')
    await page.getByLabel('Confirmar senha').fill('senha123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByText('E-mail já cadastrado.')).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })

  test('register validates password confirmation client-side', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Nome').fill('Fulano de Tal')
    await page.getByLabel('E-mail', { exact: true }).fill(`fulano-${Date.now()}@demo.nft`)
    await page.getByLabel('Senha', { exact: true }).fill('senha123')
    await page.getByLabel('Confirmar senha').fill('outrasenha')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
  })

  test('login rejects invalid credentials with an inline error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(USERS.ana.email)
    await page.getByLabel('Senha').fill('wrong-password')
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login succeeds and logout clears the session', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await expect(page.getByRole('button', { name: 'Ana' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Ana' })).toBeVisible()

    await page.getByRole('button', { name: 'Ana' }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()

    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('session expiration is recovered on refresh by redirecting to login with a return path', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/wallets')
    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()

    await expireSession(page)
    await page.reload()

    await page.waitForURL((url) => url.pathname === '/login')
    const redirect = new URL(page.url()).searchParams.get('redirect')
    expect(redirect).toContain('/wallets')

    // Logging back in returns the collector to the page they were kicked out of.
    await page.getByLabel('E-mail').fill(USERS.ana.email)
    await page.getByLabel('Senha').fill(USERS.ana.password)
    await page.locator('form').getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL((url) => url.pathname === '/wallets')
  })

  test('session expiration mid-navigation (no refresh) redirects once a private request fails', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/wallets')
    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
    await expireSession(page)

    // Triggers a fresh authenticated request (GET /api/wallets on the dialog's mutation
    // target) without reloading — the request fails with 401 and the app must react to it.
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await page.getByLabel('Nome').fill('Carteira teste')
    await page.getByLabel('Endereço').fill('0x1111111111111111111111111111111111111111')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await page.waitForURL((url) => url.pathname === '/login')
  })

  test('switching users clears the previous session private data from the UI', async ({ page }) => {
    await loginViaUi(page, USERS.ana.email, USERS.ana.password)
    await page.goto('/profile')
    await expect(page.getByLabel('Nome')).toHaveValue(USERS.ana.name)

    await page.getByRole('button', { name: 'Ana' }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()

    await loginViaUi(page, USERS.bruno.email, USERS.bruno.password)
    await page.goto('/profile')
    await expect(page.getByLabel('Nome')).toHaveValue(USERS.bruno.name)
    await expect(page.getByText(USERS.ana.name)).not.toBeVisible()
  })
})
