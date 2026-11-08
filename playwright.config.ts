import { defineConfig, devices } from '@playwright/test'

const PORT = 3200

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/rrhh_e2e bun run db:reset && NUXT_IGNORE_LOCK=1 DATABASE_URL=postgresql://postgres:postgres@localhost:5433/rrhh_e2e BETTER_AUTH_URL=http://localhost:${PORT} bun run dev --port ${PORT}`,
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: false,
    timeout: 150_000,
  },
})
