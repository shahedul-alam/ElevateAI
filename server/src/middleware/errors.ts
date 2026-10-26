import type { ErrorRequestHandler, RequestHandler } from 'express'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: { message: status >= 500 ? 'Internal server error' : err.message } })
}
