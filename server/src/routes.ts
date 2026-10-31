import { Router } from 'express'
import { candidateProfileRouter } from './modules/candidate-profile/candidate-profile.routes'
import { catalogRouter } from './modules/catalog/catalog.routes'
import { healthRouter } from './modules/health/health.routes'
import { jobsRouter } from './modules/jobs/jobs.routes'
import { userRouter } from './modules/user/user.routes'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(userRouter)
apiRouter.use(catalogRouter)
apiRouter.use(candidateProfileRouter)
apiRouter.use(jobsRouter)
