import { requireAiConsent } from '../ai/ai-consent'
import { Router } from 'express'
import { limiter as makeLimiter } from '../../middleware/rate-limit'
import { validate } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { postDraft } from './job-assistant.controller'
import { draftInputSchema } from './job-assistant.schema'

const limiter = makeLimiter({
  name: 'ai-draft',
  windowMs: 60 * 60_000,
  limit: 20,
  key: (req) => req.auth!.user.id,
  message: 'Too many drafts, try again later',
})

export const jobAssistantRouter = Router()

jobAssistantRouter.post(
  '/employer/jobs/ai-draft',
  requireAuth,
  requireRole('employer'),
  requireAiConsent,
  limiter,
  validate(draftInputSchema),
  postDraft,
)
