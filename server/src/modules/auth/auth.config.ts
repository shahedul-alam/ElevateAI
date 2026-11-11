import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prisma } from '../../config/db'
import { env } from '../../config/env'
import { sendMail } from './mail.service'
import {
  approveEmailChangeMail,
  existingAccountMail,
  resetPasswordMail,
  verifyEmailMail,
} from './mail.templates'

export const SIGNUP_ROLES = ['candidate', 'employer'] as const
export const CLIENT_IP_HEADER = 'x-client-ip'

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
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendMail({ to: user.email, ...resetPasswordMail(url) })
    },
    // Only called with verification on (enumeration protection): the caller sees the same response as
    // a new sign-up, the real owner gets this mail. With it off, sign-up answers 409 as before.
    onExistingUserSignUp: async ({ user }) => {
      sendMail({
        to: user.email,
        ...existingAccountMail(`${env.CLIENT_ORIGIN}/login`, `${env.CLIENT_ORIGIN}/forgot-password`),
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendMail({ to: user.email, ...verifyEmailMail(url) })
    },
  },
  user: {
    // Verified users approve from their current address first, then verify the new one, so a
    // hijacked session cannot silently move the account to another mailbox.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        sendMail({ to: user.email, ...approveEmailChangeMail(newEmail, url) })
      },
    },
    additionalFields: {
      // input stays true so sign-up can choose a role; the hook below restricts it.
      role: { type: 'string', required: true, defaultValue: 'candidate' },
      // Read-only here: only the admin endpoints set it. input:false keeps it out of sign-up/update-user.
      suspendedAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      // Covers every way of getting a session (login, password-reset and verification auto sign-in).
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { suspendedAt: true },
          })
          if (user?.suspendedAt) throw new APIError('FORBIDDEN', { message: 'Account suspended' })
        },
      },
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
      if (ctx.path === '/update-user' && ctx.body && 'suspendedAt' in ctx.body) {
        throw new APIError('BAD_REQUEST', { message: 'suspendedAt cannot be changed' })
      }
    }),
  },
  rateLimit: {
    // Production only, so dev and e2e runs are not throttled.
    enabled: env.NODE_ENV === 'production',
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 60, max: 3 },
      '/send-verification-email': { window: 60, max: 3 },
      '/change-email': { window: 60, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    // Set by auth.routes.ts from Express's req.ip (never taken from the client), so rate limits are per client.
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
})

export type Session = typeof auth.$Infer.Session
