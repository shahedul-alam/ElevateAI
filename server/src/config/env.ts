import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default('http://localhost:4000'),
  // Number of reverse proxies in front of the API (0 = none). Express then takes the client IP from
  // X-Forwarded-For at exactly that many hops; never use "true", which trusts a spoofable header.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // Outgoing mail (verification, password reset). Without SMTP_URL, mails are printed to the console.
  SMTP_URL: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).default('ElevateAI <no-reply@elevateai.local>'),
  // When true, email/password login is refused until the address is verified.
  REQUIRE_EMAIL_VERIFICATION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // AI features (resume import). Without a key the AI routes answer 503.
  OPENAI_API_KEY: z.string().min(1).optional(),
  AI_MODEL_EXTRACT: z.string().min(1).default('gpt-6.1-sol'),
  // false turns every AI call off (503), whatever the key says. The e2e stacks set it so tests never reach OpenAI.
  AI_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Test-only: extractObject returns each feature's canned output instead of calling OpenAI. Refused in production.
  AI_STUB: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Only used by `bun run db:seed-admin`.
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment:\n' + z.prettifyError(parsed.error))
  process.exit(1)
}

if (parsed.data.AI_STUB) {
  if (parsed.data.NODE_ENV === 'production') {
    console.error('Invalid environment: AI_STUB must not be set in production')
    process.exit(1)
  }
  console.warn('AI_STUB is on: AI features return canned output and never call OpenAI')
}

export const env = parsed.data
