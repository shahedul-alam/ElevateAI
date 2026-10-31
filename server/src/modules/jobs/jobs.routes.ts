import { Router } from 'express'
import { HttpError } from '../../middleware/errors'
import { validate, validateQuery } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import {
  changeMyJobStatus,
  createMyJob,
  getJob,
  getMyJob,
  listJobs,
  listMyJobs,
  updateMyJob,
} from './jobs.controller'
import { jobContentSchema, jobIdParamSchema, jobListQuerySchema } from './jobs.schema'

export const jobsRouter = Router()

// A malformed id can never match a job: answer 404 instead of letting the DB reject it.
jobsRouter.param('id', (req, _res, next) => {
  if (!jobIdParamSchema.safeParse(req.params).success) throw new HttpError(404, 'Job not found')
  next()
})

jobsRouter.get('/jobs', validateQuery(jobListQuerySchema), listJobs)
jobsRouter.get('/jobs/:id', getJob)

jobsRouter.use('/employer/jobs', requireAuth, requireRole('employer'))
jobsRouter.get('/employer/jobs', listMyJobs)
jobsRouter.post('/employer/jobs', validate(jobContentSchema), createMyJob)
jobsRouter.get('/employer/jobs/:id', getMyJob)
jobsRouter.put('/employer/jobs/:id', validate(jobContentSchema), updateMyJob)
jobsRouter.post('/employer/jobs/:id/publish', changeMyJobStatus('publish'))
jobsRouter.post('/employer/jobs/:id/unpublish', changeMyJobStatus('unpublish'))
jobsRouter.post('/employer/jobs/:id/close', changeMyJobStatus('close'))
