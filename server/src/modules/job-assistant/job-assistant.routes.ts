import { requireAiConsent } from '../ai/ai-consent'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { env } from '../../config/env'
import { validate } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { postDraft } from './job-assistant.controller'
import { draftInputSchema } from './job-assistant.schema'

// shortcut: in-memory per-user limit, resets on restart and is per instance; move to a DB counter before multi-instance deploys.
const limiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 20,
  keyGenerator: (req) => req.auth!.user.id,
  skip: () => env.NODE_ENV !== 'production',
  handler: (_req, res) => {
    res.status(429).json({ error: { message: 'Too many drafts, try again later' } })
  },
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
