import { prisma } from '../../config/db'
import { auth } from './auth.config'

/** Creates the admin user if the email is not taken. Returns whether a user was created. */
export async function ensureAdmin(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { created: false, role: existing.role }

  // Sign up through the API so the password is hashed like any other user's. The sign-up hook
  // rejects role 'admin' for every caller, so sign up as a candidate and promote afterwards.
  const { user } = await auth.api.signUpEmail({ body: { email, password, name: 'Admin', role: 'candidate' } })
  await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } })
  return { created: true, role: 'admin' }
}
