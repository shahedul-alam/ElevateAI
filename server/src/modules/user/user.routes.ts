import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth } from '../auth/auth.middleware'
import { deleteAiConsent, getMe, postAiConsent, putEmailNotifications } from './user.controller'
import { emailNotificationsSchema } from './user.schema'

export const userRouter = Router()

userRouter.get('/me', requireAuth, getMe)
userRouter.post('/me/ai-consent', requireAuth, postAiConsent)
userRouter.delete('/me/ai-consent', requireAuth, deleteAiConsent)
userRouter.put('/me/email-notifications', requireAuth, validate(emailNotificationsSchema), putEmailNotifications)
