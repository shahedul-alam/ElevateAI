import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env'
import { errorHandler, notFound } from './middleware/errors'
import { authRouter } from './modules/auth/auth.routes'
import { homeRouter } from './modules/home/home.routes'
import { apiRouter } from './routes'

export function createApp() {
  const app = express()

  // Behind a proxy, req.ip would be the proxy for everyone: all clients would share one rate-limit bucket.
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY)

  app.use(helmet())
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
  // Better Auth must be mounted before express.json(): body parsers consume the request stream.
  app.use(authRouter)
  app.use(express.json())

  app.use(homeRouter)
  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
