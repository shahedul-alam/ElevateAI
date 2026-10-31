import { Router } from 'express'
import { validateQuery } from '../../middleware/validate'
import { listCatalog } from './catalog.controller'
import { catalogQuerySchema } from './catalog.schema'

export const catalogRouter = Router()

catalogRouter.get('/catalog', validateQuery(catalogQuerySchema), listCatalog)
