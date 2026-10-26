import type { RequestHandler } from 'express'
import { getHealth } from './health.service'

export const health: RequestHandler = async (_req, res) => {
  const result = await getHealth()
  res.status(result.db ? 200 : 503).json(result)
}
