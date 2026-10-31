import { Router } from 'express'
import { requireUuidParam, validate, validateQuery } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import {
  applyToJobHandler,
  changeStatusHandler,
  listJobApplicants,
  listMyApplications,
} from './applications.controller'
import { applicantsQuerySchema, changeStatusSchema } from './applications.schema'

export const applicationsRouter = Router()

const candidateOnly = [requireAuth, requireRole('candidate')]
const employerOnly = [requireAuth, requireRole('employer')]

applicationsRouter.post('/jobs/:id/apply', requireUuidParam(), ...candidateOnly, applyToJobHandler)
applicationsRouter.get('/candidate/applications', ...candidateOnly, listMyApplications)
applicationsRouter.get(
  '/employer/jobs/:id/applicants',
  requireUuidParam(),
  ...employerOnly,
  validateQuery(applicantsQuerySchema),
  listJobApplicants,
)
applicationsRouter.patch(
  '/applications/:id/status',
  requireUuidParam(),
  ...employerOnly,
  validate(changeStatusSchema),
  changeStatusHandler,
)
