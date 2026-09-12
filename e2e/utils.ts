import type { Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@demo.nft', password: 'demo1234', name: 'Ana Souza', id: 'user-ana' },
  bruno: { email: 'bruno@demo.nft', password: 'demo1234', name: 'Bruno Lima', id: 'user-bruno' },
}

export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  // The header also renders an "Entrar" button while logged out — scope to the form.
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/')
}

/**
 * Requests made from Node (page.request) never pass through the page's Service Worker, so
 * they'd bypass MSW entirely. Every call to a mocked /api/* endpoint from a test — including
 * the test-only _simulate-update/_expire/_resolve hooks — must run inside the page via fetch.
 */
export async function fetchInPage<T>(
  page: Page,
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<T> {
  return page.evaluate(
    async ({ url, init }) => {
      const res = await fetch(url, init)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`fetch ${url} failed: ${res.status} ${text}`)
      }
      const text = await res.text()
      return text ? JSON.parse(text) : null
    },
    { url, init },
  )
}

export async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('nft-marketplace-auth-token'))
}

export async function simulateNftUpdate(
  page: Page,
  nftId: string,
  body: { editionId?: string; priceEth?: string; available?: number },
) {
  await fetchInPage(page, `/api/nfts/${nftId}/_simulate-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function expireSession(page: Page) {
  const token = await getAuthToken(page)
  await fetchInPage(page, '/api/auth/_expire', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export type MockScenario = 'default' | 'slow' | 'flaky' | 'offline' | 'empty'

/**
 * Switches the MSW network-condition scenario (see src/mocks/scenario.ts). Playwright's
 * page.route() interception happens at a layer MSW's Service Worker responses never reach
 * (handled requests don't hit the real network at all), so failure/latency scenarios in these
 * tests are driven through this app-level mechanism instead of route mocking.
 */
export async function setScenario(page: Page, scenario: MockScenario) {
  // getScenario() re-reads ?mock_scenario from the current URL on every call and re-persists
  // it to localStorage, so a query param left over from an earlier goto() would keep winning
  // over this override — strip it from the address bar too, not just localStorage.
  await page.evaluate((s) => {
    localStorage.setItem('nft-marketplace-mock-scenario', s)
    const url = new URL(window.location.href)
    if (url.searchParams.has('mock_scenario')) {
      url.searchParams.delete('mock_scenario')
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, scenario)
}

export async function resolveOrder(page: Page, orderId: string, status: 'confirmed' | 'declined') {
  const token = await getAuthToken(page)
  return fetchInPage(page, `/api/orders/${orderId}/_resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  })
}

/** Adds the first available edition of a given NFT (by fixture id, e.g. "nft-0") to the cart via the UI. */
export async function addNftToCartViaUi(page: Page, nftId: string) {
  await page.goto(`/nfts/${nftId}`)
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await page.getByText('Item adicionado ao carrinho.').waitFor()
}

/** Same as addNftToCartViaUi, then navigates to /cart once the item is confirmed added. */
export async function addNftToCartAndOpenCart(page: Page, nftId: string) {
  await addNftToCartViaUi(page, nftId)
  await page.goto('/cart')
}

export async function connectWalletInCheckout(page: Page) {
  await page.getByText(/Carteira/i, { exact: false })
  const firstWalletRadio = page.locator('input[type="radio"][name="wallet"]').first()
  await firstWalletRadio.check()
  await page.getByRole('button', { name: 'Aprovar conexão' }).click()
}
