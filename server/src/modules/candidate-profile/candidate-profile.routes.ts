import express, { Router } from 'express'
import { validate } from '../../middleware/validate'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { PHOTO_LIMIT, PHOTO_TYPES } from './candidate-photo'
import {
  deleteMyPhoto,
  getMyPhoto,
  getMyPhotoInfo,
  getMyProfile,
  getMyVersions,
  putMyPhoto,
  putMyProfile,
  restoreMyVersion,
} from './candidate-profile.controller'
import { profileSaveSchema } from './candidate-profile.schema'

export const candidateProfileRouter = Router()

candidateProfileRouter.use('/candidate/profile', requireAuth, requireRole('candidate'))
candidateProfileRouter.get('/candidate/profile', getMyProfile)
candidateProfileRouter.put('/candidate/profile', validate(profileSaveSchema), putMyProfile)
candidateProfileRouter.get('/candidate/profile/versions', getMyVersions)
candidateProfileRouter.post('/candidate/profile/versions/:id/restore', restoreMyVersion)

// The photo is outside the versioned resume, like contact details.
candidateProfileRouter.get('/candidate/profile/photo-info', getMyPhotoInfo)
candidateProfileRouter.get('/candidate/profile/photo', getMyPhoto)
candidateProfileRouter.put(
  '/candidate/profile/photo',
  express.raw({ type: PHOTO_TYPES, limit: PHOTO_LIMIT }),
  putMyPhoto,
)
candidateProfileRouter.delete('/candidate/profile/photo', deleteMyPhoto)
