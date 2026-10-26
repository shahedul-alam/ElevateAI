import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prisma } from '../../config/db'
import { env } from '../../config/env'

export const SIGNUP_ROLES = ['candidate', 'employer'] as const

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.CLIENT_ORIGIN],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // input stays true so sign-up can choose a role; the hook below restricts it.
      role: { type: 'string', required: true, defaultValue: 'candidate' },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        const role = ctx.body?.role
        if (!SIGNUP_ROLES.includes(role)) {
          throw new APIError('BAD_REQUEST', { message: `role must be one of: ${SIGNUP_ROLES.join(', ')}` })
        }
      }
      if (ctx.path === '/update-user' && ctx.body && 'role' in ctx.body) {
        throw new APIError('BAD_REQUEST', { message: 'role cannot be changed' })
      }
    }),
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
  advanced: { useSecureCookies: process.env.NODE_ENV === 'production' },
})

export type Session = typeof auth.$Infer.Session
