import { defineConfig } from '@playwright/test'

const noProxy = Array.from(new Set([
  ...(process.env.NO_PROXY?.split(',') ?? []),
  ...(process.env.no_proxy?.split(',') ?? []),
  '127.0.0.1',
  'localhost'
].filter(Boolean))).join(',')

process.env.NO_PROXY = noProxy
process.env.no_proxy = noProxy

export default defineConfig({
  testDir: './apps/studio/e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3001',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev:studio',
    env: {
      ...process.env,
      NO_PROXY: noProxy,
      no_proxy: noProxy
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3001'
  }
})
