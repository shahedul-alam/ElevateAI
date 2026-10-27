import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { HttpError } from './errors'

/** Validates `req.body` against a Zod schema and replaces it with the parsed (trimmed, normalised) data. */
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
      throw new HttpError(400, 'Invalid request', details)
    }
    req.body = result.data
    next()
  }
