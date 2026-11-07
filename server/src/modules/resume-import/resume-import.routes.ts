import { requireAiConsent } from '../ai/ai-consent'
import express, { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { env } from '../../config/env'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { postImport } from './resume-import.controller'
import { RESUME_LIMIT, RESUME_TYPES } from './resume-import.file'

// shortcut: in-memory per-user limit, resets on restart and is per instance; move to a DB counter before multi-instance deploys.
const limiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  keyGenerator: (req) => req.auth!.user.id,
  skip: () => env.NODE_ENV !== 'production',
  handler: (_req, res) => {
    res.status(429).json({ error: { message: 'Too many resume imports, try again later' } })
  },
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
