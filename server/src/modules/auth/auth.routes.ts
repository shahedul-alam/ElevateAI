import { toNodeHandler } from 'better-auth/node'
import express, { Router } from 'express'
import { HttpError } from '../../middleware/errors'
import { limiter } from '../../middleware/rate-limit'
import { validate } from '../../middleware/validate'
import { auth, CLIENT_IP_HEADER } from './auth.config'
import { login, register } from './auth.controller'
import { loginSchema, registerSchema } from './auth.schema'

// Better Auth's built-in limiter does not cover server-side auth.api calls, so these routes have their own.
const registerLimiter = limiter({ name: 'register', windowMs: 60_000, limit: 5, message: 'Too many sign-up attempts, try again later' })
const loginLimiter = limiter({ name: 'login', windowMs: 60_000, limit: 5, message: 'Too many sign-in attempts, try again later' })

const notFoundRoute = () => {
  throw new HttpError(404, 'Not found')
}

// Handles every /api/auth/* endpoint. Mounted before the global express.json(), so routes that
// need a parsed body apply it themselves.
export const authRouter = Router()

// Better Auth does not get the socket address from toNodeHandler, so hand it the client IP through a
// header we always overwrite (a client-supplied value is discarded). req.ip honours Express's
// `trust proxy` setting if the API is deployed behind a proxy.
authRouter.use('/api/auth', (req, _res, next) => {
  req.headers[CLIENT_IP_HEADER] = req.ip
  next()
})

authRouter.post('/api/auth/register', registerLimiter, express.json(), validate(registerSchema), register)
authRouter.post('/api/auth/login', loginLimiter, express.json(), validate(loginSchema), login)
// Better Auth's raw sign-up/sign-in skip our validation; /register and /login are the public entry points.
authRouter.post('/api/auth/sign-up/email', notFoundRoute)
authRouter.post('/api/auth/sign-in/email', notFoundRoute)
authRouter.all('/api/auth/*splat', toNodeHandler(auth))
