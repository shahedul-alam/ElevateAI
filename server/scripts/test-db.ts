// Manages the throwaway database used by the Playwright e2e suite.
//   bun scripts/test-db.ts setup   create the database if missing, then apply migrations
//   bun scripts/test-db.ts reset   truncate every table (keeps the migration history)
import { SQL } from 'bun'

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/elevateai_test'

const url = new URL(TEST_DATABASE_URL)
const dbName = decodeURIComponent(url.pathname.slice(1))

// Never touch a database that is not clearly a test one (a bad TEST_DATABASE_URL must not wipe dev data).
if (!/^[a-z0-9_]+_test$/.test(dbName)) {
  console.error(`Refusing to use "${dbName}": the test database name must match [a-z0-9_]+_test`)
  process.exit(1)
}

async function setup() {
  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'
  const admin = new SQL(adminUrl.toString())
  try {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`
    if (rows.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${dbName}"`)
      console.log(`Created database ${dbName}`)
    }
  } finally {
    await admin.close()
  }

  const proc = Bun.spawnSync(['bunx', '--bun', 'prisma', 'migrate', 'deploy'], {
    cwd: import.meta.dir + '/..',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1)
}

async function reset() {
  const db = new SQL(TEST_DATABASE_URL)
  try {
    const tables = await db`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
    if (tables.length === 0) return
    const list = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ')
    await db.unsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
  } finally {
    await db.close()
  }
}

const command = process.argv[2]
if (command === 'setup') await setup()
else if (command === 'reset') await reset()
else {
  console.error('Usage: bun scripts/test-db.ts <setup|reset>')
  process.exit(1)
}
