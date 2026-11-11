import IORedis from 'ioredis'
import { env } from './env'

// maxRetriesPerRequest: null is required by BullMQ workers; the rate limiter shares the connection.
export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
redis.on('error', (err) => console.error('Redis error:', err.message))
