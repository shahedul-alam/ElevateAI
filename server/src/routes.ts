import { Router } from 'express'
import { applicationsRouter } from './modules/applications/applications.routes'
import { candidateProfileRouter } from './modules/candidate-profile/candidate-profile.routes'
import { catalogRouter } from './modules/catalog/catalog.routes'
import { healthRouter } from './modules/health/health.routes'
import { jobsRouter } from './modules/jobs/jobs.routes'
import { matchingRouter } from './modules/matching/matching.routes'
import { companyRouter } from './modules/company/company.routes'
import { notificationsRouter } from './modules/notifications/notifications.routes'
import { userRouter } from './modules/user/user.routes'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(userRouter)
apiRouter.use(catalogRouter)
apiRouter.use(candidateProfileRouter)
// matchingRouter first: its `/jobs/recommended` must win over the jobs router's `/jobs/:id`.
apiRouter.use(matchingRouter)
apiRouter.use(jobsRouter)
apiRouter.use(applicationsRouter)
apiRouter.use(companyRouter)
apiRouter.use(notificationsRouter)
