import { Router } from 'express'
import { healthRouter } from './modules/health/health.routes'
import { userRouter } from './modules/user/user.routes'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(userRouter)
