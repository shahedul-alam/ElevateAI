import { createApp } from './app'
import { connectDb, disconnectDb } from './config/db'
import { env } from './config/env'
import { startWorkers, stopWorkers } from './config/queues'
import { ensureAdmin } from './modules/auth/auth.service'

const app = createApp()

await connectDb()
// Idempotent: creates the admin on first boot, does nothing afterwards. A failure is logged, not fatal.
if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
  try {
    const { created } = await ensureAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
    if (created) console.log(`Seeded admin ${env.ADMIN_EMAIL}`)
  } catch (err) {
    console.error('Admin seeding failed; continuing without it:', err)
  }
}
const server = app.listen(env.PORT, () => console.log(`Server listening on http://localhost:${env.PORT}`))

// Summary worker plus the 6-hourly notification prune (BullMQ scheduler). Not fatal if Redis is down at boot.
await startWorkers().catch((err) => console.error('Could not start workers:', err))

async function shutdown() {
  server.close()
  await stopWorkers().catch(() => {})
  await disconnectDb()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
