import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import {
  getMyProfile,
  getMyVersions,
  putMyProfile,
  restoreMyVersion,
} from './candidate-profile.controller'
import { profileContentSchema } from './candidate-profile.schema'

export const candidateProfileRouter = Router()

candidateProfileRouter.use('/candidate/profile', requireAuth, requireRole('candidate'))
candidateProfileRouter.get('/candidate/profile', getMyProfile)
candidateProfileRouter.put('/candidate/profile', validate(profileContentSchema), putMyProfile)
candidateProfileRouter.get('/candidate/profile/versions', getMyVersions)
candidateProfileRouter.post('/candidate/profile/versions/:id/restore', restoreMyVersion)
