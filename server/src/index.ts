import cors from 'cors'
import express from 'express'
import { connectDb, disconnectDb, isDbConnected } from './db'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  const db = isDbConnected()
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db })
})

await connectDb()
const server = app.listen(port, () => console.log(`Server listening on http://localhost:${port}`))

async function shutdown() {
  server.close()
  await disconnectDb()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
