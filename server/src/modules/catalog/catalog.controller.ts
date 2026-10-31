import type { RequestHandler } from 'express'
import type { CatalogQuery } from './catalog.schema'
import { searchCatalog } from './catalog.service'

export const listCatalog: RequestHandler = async (_req, res) => {
  const { kind, q, limit } = res.locals.query as CatalogQuery
  res.json({ terms: await searchCatalog(kind, q, limit) })
}
