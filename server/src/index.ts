import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { connectDb, disconnectDb, isDbConnected } from './db'
import { env } from './env'
import { errorHandler, notFound } from './middleware/errors'

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
// Better Auth mounts its handler here, before express.json(), in the auth step.
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  const db = await isDbConnected()
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db })
})

app.use(notFound)
app.use(errorHandler)

await connectDb()
const server = app.listen(env.PORT, () => console.log(`Server listening on http://localhost:${env.PORT}`))

async function shutdown() {
  server.close()
  await disconnectDb()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
