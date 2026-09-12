import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'yarn dev --port 5183',
    url: 'http://localhost:5183',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_ENABLE_MOCKS: 'true',
    },
  },
})
