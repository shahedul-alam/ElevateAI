import { toNodeHandler } from 'better-auth/node'
import { Router } from 'express'
import { auth } from './auth.config'

// Handles every /api/auth/* endpoint (sign-up, sign-in, sign-out, session, ...).
export const authRouter = Router()

authRouter.all('/api/auth/*splat', toNodeHandler(auth))
