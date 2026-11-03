import express, { Router } from 'express'
import { HttpError } from '../../middleware/errors'
import { validate, validateQuery } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import {
  getImageHandler,
  getMine,
  getOne,
  list,
  removeMine,
  saveMine,
  uploadMine,
  verify,
} from './company.controller'
import { IMAGE_LIMITS, IMAGE_TYPES } from './company.images'
import {
  companyIdParamSchema,
  companyListQuerySchema,
  companySaveSchema,
  verificationSchema,
} from './company.schema'

export const companyRouter = Router()

// A malformed id can never match a company: answer 404 instead of letting the DB reject it.
companyRouter.param('id', (req, _res, next) => {
  if (!companyIdParamSchema.safeParse(req.params).success) throw new HttpError(404, 'Company not found')
  next()
})

companyRouter.get('/companies', validateQuery(companyListQuerySchema), list)
companyRouter.get('/companies/:id', getOne)
companyRouter.get('/companies/:id/:kind', getImageHandler)

// Images arrive as the raw request body. The parser limit stops oversize uploads before they are
// buffered; the service checks the bytes themselves again.
const rawParsers = {
  logo: express.raw({ type: IMAGE_TYPES, limit: IMAGE_LIMITS.logo }),
  cover: express.raw({ type: IMAGE_TYPES, limit: IMAGE_LIMITS.cover }),
}
const rawByKind: express.RequestHandler = (req, res, next) =>
  rawParsers[req.params.kind === 'cover' ? 'cover' : 'logo'](req, res, next)

companyRouter.use('/employer/company', requireAuth, requireRole('employer'))
companyRouter.get('/employer/company', getMine)
companyRouter.put('/employer/company', validate(companySaveSchema), saveMine)
companyRouter.put('/employer/company/:kind', rawByKind, uploadMine)
companyRouter.delete('/employer/company/:kind', removeMine)

companyRouter.patch(
  '/admin/companies/:id/verification',
  requireAuth,
  requireRole('admin'),
  validate(verificationSchema),
  verify,
)
