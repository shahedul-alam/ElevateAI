import IORedis from 'ioredis'
import { env } from './env'

// maxRetriesPerRequest: null is required by BullMQ workers (commands queue until Redis is back).
export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
redis.on('error', (err) => console.error('Redis error:', err.message))

// Rate limiter connection: commands give up after a few seconds, so an unreachable Redis rejects (and the limiter
// fails open via passOnStoreError) rather than hanging login and register. The offline queue stays on because the
// store loads its Lua scripts at startup, before the connection is ready.
export const limiterRedis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  commandTimeout: 3000,
})
limiterRedis.on('error', (err) => console.error('Rate limiter Redis error:', err.message))
