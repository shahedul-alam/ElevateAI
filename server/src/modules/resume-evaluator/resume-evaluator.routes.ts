import { Router } from 'express'
import { requireAuth, requireRole } from '../auth/auth.middleware'
import { getMyEvaluation, postMyEvaluation } from './resume-evaluator.controller'

export const resumeEvaluatorRouter = Router()

resumeEvaluatorRouter.use('/candidate/profile/evaluation', requireAuth, requireRole('candidate'))
resumeEvaluatorRouter.get('/candidate/profile/evaluation', getMyEvaluation)
resumeEvaluatorRouter.post('/candidate/profile/evaluation', postMyEvaluation)
