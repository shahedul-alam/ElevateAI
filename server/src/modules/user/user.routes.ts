import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware'
import { deleteAiConsent, getMe, postAiConsent } from './user.controller'

export const userRouter = Router()

userRouter.get('/me', requireAuth, getMe)
userRouter.post('/me/ai-consent', requireAuth, postAiConsent)
userRouter.delete('/me/ai-consent', requireAuth, deleteAiConsent)
