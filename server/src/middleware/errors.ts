import type { ErrorRequestHandler, RequestHandler } from 'express'

export type ErrorDetail = { field: string; message: string }

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: ErrorDetail[],
  ) {
    super(message)
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Client errors from middleware (e.g. body-parser's malformed JSON) carry a 4xx status and expose: true.
  const status =
    err instanceof HttpError
      ? err.status
      : err?.expose === true && err.status >= 400 && err.status < 500
        ? err.status
        : 500
  if (status >= 500) console.error(err)
  res.status(status).json({
    error: {
      message: status >= 500 ? 'Internal server error' : err.message,
      ...(status < 500 && err instanceof HttpError && err.details && { details: err.details }),
    },
  })
}
