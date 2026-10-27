import { fromNodeHeaders } from 'better-auth/node'
import type { RequestHandler, Response } from 'express'
import { loginUser, registerUser } from './auth.service'

type SessionUser = { id: string; email: string; name: string; role?: unknown }

// Forward the session cookie(s) set by Better Auth so the caller is signed in.
function sendSession(res: Response, status: number, user: SessionUser, headers: Headers) {
  for (const cookie of headers.getSetCookie()) res.append('Set-Cookie', cookie)
  const { id, email, name, role } = user
  res.status(status).json({ user: { id, email, name, role } })
}

export const register: RequestHandler = async (req, res) => {
  const { user, headers } = await registerUser(req.body, fromNodeHeaders(req.headers))
  sendSession(res, 201, user, headers)
}

export const login: RequestHandler = async (req, res) => {
  const { user, headers } = await loginUser(req.body, fromNodeHeaders(req.headers))
  sendSession(res, 200, user, headers)
}
