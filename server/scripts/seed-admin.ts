import { disconnectDb } from '../src/config/db'
import { env } from '../src/config/env'
import { ensureAdmin } from '../src/modules/auth/auth.service'

if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env')
  process.exit(1)
}

const { created, role } = await ensureAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
console.log(
  created ? `Created admin ${env.ADMIN_EMAIL}` : `User ${env.ADMIN_EMAIL} already exists (role: ${role}); nothing to do`,
)

await disconnectDb()
