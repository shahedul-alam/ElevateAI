import { Router } from 'express'
import { requireUuidParam, validate, validateQuery } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import {
  activityHandler,
  addNoteHandler,
  applyToJobHandler,
  changeStatusHandler,
  deleteNoteHandler,
  listAllApplications,
  listJobApplicants,
  listMyApplications,
  photoHandler,
  ratingHandler,
} from './applications.controller'
import {
  applicantsQuerySchema,
  changeStatusSchema,
  employerApplicationsQuerySchema,
  noteSchema,
  ratingSchema,
} from './applications.schema'

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
applicationsRouter.get(
  '/employer/applications',
  ...employerOnly,
  validateQuery(employerApplicationsQuerySchema),
  listAllApplications,
)
applicationsRouter.get('/employer/applications/:id/activity', requireUuidParam(), ...employerOnly, activityHandler)
applicationsRouter.get('/employer/applications/:id/photo', requireUuidParam(), ...employerOnly, photoHandler)
applicationsRouter.post(
  '/employer/applications/:id/notes',
  requireUuidParam(),
  ...employerOnly,
  validate(noteSchema),
  addNoteHandler,
)
applicationsRouter.delete(
  '/employer/applications/:id/notes/:noteId',
  requireUuidParam(),
  requireUuidParam('noteId'),
  ...employerOnly,
  deleteNoteHandler,
)
applicationsRouter.patch(
  '/employer/applications/:id/rating',
  requireUuidParam(),
  ...employerOnly,
  validate(ratingSchema),
  ratingHandler,
)
applicationsRouter.patch(
  '/applications/:id/status',
  requireUuidParam(),
  ...employerOnly,
  validate(changeStatusSchema),
  changeStatusHandler,
)
