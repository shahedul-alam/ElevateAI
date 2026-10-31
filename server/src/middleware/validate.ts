import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { HttpError } from './errors'

const parseOrThrow = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
    throw new HttpError(400, 'Invalid request', details)
  }
  return result.data
}

/** Validates `req.body` against a Zod schema and replaces it with the parsed (trimmed, normalised) data. */
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    req.body = parseOrThrow(schema, req.body)
    next()
  }

/** Validates `req.query` (read-only in Express 5), exposing the parsed data as `res.locals.query`. */
export const validateQuery =
  (schema: z.ZodType): RequestHandler =>
  (req, res, next) => {
    res.locals.query = parseOrThrow(schema, req.query)
    next()
  }
