import { Router } from 'express'
import { requireUuidParam, validateQuery } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { getJobGap, getRecommendedJobs } from './matching.controller'
import { recommendQuerySchema } from './matching.schema'

export const matchingRouter = Router()

// Must be mounted before the jobs router, whose `/jobs/:id` would otherwise treat "recommended" as an id.
matchingRouter.get(
  '/jobs/recommended',
  requireAuth,
  requireRole('candidate'),
  validateQuery(recommendQuerySchema),
  getRecommendedJobs,
)
matchingRouter.get('/jobs/:id/gap', requireUuidParam(), requireAuth, requireRole('candidate'), getJobGap)
