import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env'
import { errorHandler, notFound } from './middleware/errors'
import { authRouter } from './modules/auth/auth.routes'
import { apiRouter } from './routes'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
  // Better Auth must be mounted before express.json(): body parsers consume the request stream.
  app.use(authRouter)
  app.use(express.json())

  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
