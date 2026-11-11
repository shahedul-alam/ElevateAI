import { requireAiConsent } from '../ai/ai-consent'
import express, { Router } from 'express'
import { limiter as makeLimiter } from '../../middleware/rate-limit'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { postImport } from './resume-import.controller'
import { RESUME_LIMIT, RESUME_TYPES } from './resume-import.file'

const limiter = makeLimiter({
  name: 'resume-import',
  windowMs: 60 * 60_000,
  limit: 10,
  key: (req) => req.auth!.user.id,
  message: 'Too many resume imports, try again later',
})

export const resumeImportRouter = Router()

resumeImportRouter.post(
  '/candidate/profile/import',
  requireAuth,
  requireRole('candidate'),
  requireAiConsent,
  limiter,
  express.raw({ type: RESUME_TYPES, limit: RESUME_LIMIT }),
  postImport,
)
