import { defineConfig, devices } from '@playwright/test'

// The e2e stack is isolated from dev: own database (elevateai_test), own ports.
const SERVER_PORT = 4100
const CLIENT_PORT = 5174
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/elevateai_test'

export default defineConfig({
  testDir: './e2e',
  // One shared database, so run serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Creates the test database, applies migrations and seeds the catalog first, so a fresh clone just works.
      command: 'bun run test:db:setup && bun run db:seed-catalog && bun src/index.ts',
      cwd: './server',
      url: `http://localhost:${SERVER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(SERVER_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        TEST_DATABASE_URL,
        CLIENT_ORIGIN: `http://localhost:${CLIENT_PORT}`,
        BETTER_AUTH_URL: `http://localhost:${SERVER_PORT}`,
        BETTER_AUTH_SECRET: 'e2e-only-secret-not-for-real-use-0123456789',
        // Fixed e2e admin (seeded on startup) so a developer's .env admin never lands in the test database.
        ADMIN_EMAIL: 'admin@e2e.test',
        ADMIN_PASSWORD: 'e2e-admin-password-123',
      },
    },
    {
      command: `bunx --bun vite --port ${CLIENT_PORT} --strictPort`,
      cwd: './client',
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${SERVER_PORT}` },
    },
  ],
})
