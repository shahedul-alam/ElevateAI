import { isDbConnected } from '../../config/db'

export async function getHealth() {
  const db = await isDbConnected()
  return { status: db ? 'ok' : 'degraded', db }
}
