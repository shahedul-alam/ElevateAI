import { Router } from 'express'
import { validate, validateQuery, requireUuidParam } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { adminJobsQuerySchema, adminUsersQuerySchema, suspensionSchema } from './admin.schema'
import {
  jobs,
  overview,
  restoreOneJob,
  restoreOneUser,
  suspendOneJob,
  suspendOneUser,
  users,
} from './admin.controller'

export const adminRouter = Router()

// Company verification (PATCH /admin/companies/:id/verification) lives in the company module.
adminRouter.use('/admin', requireAuth, requireRole('admin'))
adminRouter.get('/admin/overview', overview)
adminRouter.get('/admin/users', validateQuery(adminUsersQuerySchema), users)
adminRouter.post('/admin/users/:id/suspension', validate(suspensionSchema), suspendOneUser)
adminRouter.delete('/admin/users/:id/suspension', restoreOneUser)
adminRouter.get('/admin/jobs', validateQuery(adminJobsQuerySchema), jobs)
adminRouter.post('/admin/jobs/:id/suspension', requireUuidParam(), validate(suspensionSchema), suspendOneJob)
adminRouter.delete('/admin/jobs/:id/suspension', requireUuidParam(), restoreOneJob)
