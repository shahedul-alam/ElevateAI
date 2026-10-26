import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware'
import { getMe } from './user.controller'

export const userRouter = Router()

userRouter.get('/me', requireAuth, getMe)
