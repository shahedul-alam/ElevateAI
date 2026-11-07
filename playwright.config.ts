import { defineConfig, devices } from '@playwright/test'
import { MAIL_HTTP_PORT, MAIL_SMTP_PORT } from './e2e/support/mail-sink'

// The e2e stack is isolated from dev: own database (elevateai_test), own ports.
const SERVER_PORT = 4100
const CLIENT_PORT = 5174
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/elevateai_test'

// A second stack with email verification on, its own database and a mail catcher. Only the specs
// matching VERIFICATION_SPECS run against it; the default stack keeps verification off.
const VERIFY_SERVER_PORT = 4101
const VERIFY_CLIENT_PORT = 5175
const VERIFY_DATABASE_URL =
  process.env.VERIFY_TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5433/elevateai_verify_test'
const VERIFICATION_SPECS = /auth-(verification|password-reset|change-email).*\.spec\.ts$/

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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: VERIFICATION_SPECS },
    {
      name: 'verification',
      testMatch: VERIFICATION_SPECS,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${VERIFY_CLIENT_PORT}` },
    },
  ],
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
        // Existing specs register and use users straight away; verification has its own specs.
        REQUIRE_EMAIL_VERIFICATION: 'false',
        // Never let a developer's .env SMTP_URL send real mail from the tests; the sink swallows it.
        SMTP_URL: `smtp://127.0.0.1:${MAIL_SMTP_PORT}`,
        // Fixed e2e admin (seeded on startup) so a developer's .env admin never lands in the test database.
        // Tests must never reach OpenAI: every AI call answers 503 (the apply flow also fires a background summary).
        AI_ENABLED: 'false',
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
    {
      // Receives every mail the verification stack sends; specs read them over HTTP.
      command: 'bun e2e/support/mail-sink-server.ts',
      url: `http://127.0.0.1:${MAIL_HTTP_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      command: 'bun run test:db:setup && bun src/index.ts',
      cwd: './server',
      url: `http://localhost:${VERIFY_SERVER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(VERIFY_SERVER_PORT),
        DATABASE_URL: VERIFY_DATABASE_URL,
        TEST_DATABASE_URL: VERIFY_DATABASE_URL,
        CLIENT_ORIGIN: `http://localhost:${VERIFY_CLIENT_PORT}`,
        BETTER_AUTH_URL: `http://localhost:${VERIFY_SERVER_PORT}`,
        BETTER_AUTH_SECRET: 'e2e-only-secret-not-for-real-use-0123456789',
        REQUIRE_EMAIL_VERIFICATION: 'true',
        // Set explicitly so a developer's .env SMTP_URL never sends real mail from the tests.
        SMTP_URL: `smtp://127.0.0.1:${MAIL_SMTP_PORT}`,
        // Tests must never reach OpenAI: every AI call answers 503 (the apply flow also fires a background summary).
        AI_ENABLED: 'false',
        ADMIN_EMAIL: 'admin@e2e.test',
        ADMIN_PASSWORD: 'e2e-admin-password-123',
      },
    },
    {
      command: `bunx --bun vite --port ${VERIFY_CLIENT_PORT} --strictPort`,
      cwd: './client',
      url: `http://localhost:${VERIFY_CLIENT_PORT}`,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${VERIFY_SERVER_PORT}` },
    },
  ],
})
