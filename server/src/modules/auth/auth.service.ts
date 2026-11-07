import { isAPIError } from 'better-auth/api'
import { prisma } from '../../config/db'
import { env } from '../../config/env'
import { HttpError } from '../../middleware/errors'
import { auth } from './auth.config'
import type { LoginInput, RegisterInput } from './auth.schema'
import { ensureCompany } from '../company/company.service'

// Where the emailed verification link sends the browser afterwards.
const VERIFY_URL = `${env.CLIENT_ORIGIN}/verify-email`

/** Creates the account and, unless verification is required, a session. `headers` carries the session Set-Cookie for the response. */
export async function registerUser(input: RegisterInput, requestHeaders: Headers) {
  try {
    const { headers, response } = await auth.api.signUpEmail({
      body: { ...input, callbackURL: VERIFY_URL },
      headers: requestHeaders,
      returnHeaders: true,
    })
    // Every employer gets a company page; getOwnCompany recreates it if this ever fails.
    // A duplicate sign-up gets a synthetic user back (verification on): nothing to create a company for.
    const created = await prisma.user.count({ where: { id: response.user.id } })
    if (created && response.user.role === 'employer') {
      await ensureCompany(response.user.id, response.user.name).catch((e) => console.error(e))
    }
    return { user: response.user, headers }
  } catch (err) {
    if (isAPIError(err)) {
      if (err.status === 'UNPROCESSABLE_ENTITY') {
        throw new HttpError(409, 'An account with this email already exists')
      }
      if (err.status === 'BAD_REQUEST') throw new HttpError(400, err.message)
    }
    throw err
  }
}

/** Verifies the credentials and creates a session. Wrong email and wrong password give the same error. */
export async function loginUser(input: LoginInput, requestHeaders: Headers) {
  try {
    const { headers, response } = await auth.api.signInEmail({
      body: { ...input, callbackURL: VERIFY_URL },
      headers: requestHeaders,
      returnHeaders: true,
    })
    return { user: response.user, headers }
  } catch (err) {
    if (isAPIError(err) && err.status === 'UNAUTHORIZED') {
      throw new HttpError(401, 'Invalid email or password')
    }
    // Better Auth already re-sent the verification mail (sendOnSignIn).
    if (isAPIError(err) && err.status === 'FORBIDDEN') {
      throw new HttpError(403, 'Email not verified')
    }
    throw err
  }
}

/** Creates the admin user if the email is not taken. Returns whether a user was created. */
export async function ensureAdmin(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { created: false, role: existing.role }

  // Sign up through the API so the password is hashed like any other user's. The sign-up hook
  // rejects role 'admin' for every caller, so sign up as a candidate and promote afterwards.
  const { user } = await auth.api.signUpEmail({ body: { email, password, name: 'Admin', role: 'candidate' } })
  await prisma.user.update({ where: { id: user.id }, data: { role: 'admin', emailVerified: true } })
  return { created: true, role: 'admin' }
}
