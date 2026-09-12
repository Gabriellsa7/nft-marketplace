import { expect, test } from '@playwright/test'
import { addNftToCartViaUi, loginViaUi, USERS } from './utils'

// challenge.md §8: "Avalie, no mínimo, larguras de 390, 768 e 1440 pixels" and "ausência de
// overflow horizontal indevido". A contained horizontal scroll inside a bounded element (e.g.
// the cart table's own overflow-x-auto wrapper) is fine — this checks the page itself never
// grows wider than its own viewport.
const WIDTHS = [390, 768, 1440]
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'detail', path: '/nfts/nft-0' },
  { name: 'cart', path: '/cart', setup: 'cart' as const },
  { name: 'checkout', path: '/checkout', setup: 'checkout' as const },
  { name: 'profile', path: '/profile', setup: 'auth' as const },
]

for (const width of WIDTHS) {
  for (const p of PAGES) {
    test(`no page-level horizontal overflow at ${width}px on ${p.name}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      if (p.setup === 'cart' || p.setup === 'checkout') {
        await addNftToCartViaUi(page, 'nft-21')
      }
      if (p.setup === 'checkout' || p.setup === 'auth') {
        await loginViaUi(page, USERS.ana.email, USERS.ana.password)
      }
      await page.goto(p.path)
      await expect(page.locator('body')).toBeVisible()
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(
        overflow.scrollWidth,
        `document scrollWidth ${overflow.scrollWidth} vs clientWidth ${overflow.clientWidth}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  }
}
