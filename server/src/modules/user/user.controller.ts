import type { RequestHandler } from 'express'

export const getMe: RequestHandler = (req, res) => {
  const { id, email, name, role } = req.auth!.user
  res.json({ user: { id, email, name, role } })
}
