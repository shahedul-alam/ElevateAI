import type { Request } from 'express'
import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { env } from '../config/env'
import { redis } from '../config/redis'

type Options = { name: string; windowMs: number; limit: number; message: string; key?: (req: Request) => string }

/** Redis-backed limiter shared by every server instance. Only enforced in production, so dev and e2e are not throttled. */
export const limiter = ({ name, windowMs, limit, message, key }: Options) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: key,
    skip: () => env.NODE_ENV !== 'production',
    // Fail open if Redis is down, so sign-in keeps working (Better Auth's own DB limiter still applies).
    passOnStoreError: true,
    store: new RedisStore({
      prefix: `rl:${name}:`,
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<never>,
    }),
    handler: (_req, res) => {
      res.status(429).json({ error: { message } })
    },
  })
