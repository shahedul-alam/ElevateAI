import type { RequestHandler } from 'express'

export const home: RequestHandler = (_req, res) => {
  res.json({ name: 'ElevateAI API', status: 'ok', health: '/api/health' })
}
